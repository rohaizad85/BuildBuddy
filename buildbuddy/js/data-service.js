// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\data-service.js

import { getCurrentUser } from './receipt.js';
import supabase from './supabase-client.js';

class DataService {
    constructor() {
        this.currentSessionId = null;
        this.currentCartId = null;
        this.isInitialized = false;
        this.initPromise = null;
        this.initSession();
    }

    async initSession() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._doInitSession();
        await this.initPromise;
        return this.initPromise;
    }

    async _doInitSession() {
        try {
            let sessionId = localStorage.getItem('buildbuddy_session_id');

            if (!sessionId) {
                sessionId = this.generateSessionId();
                localStorage.setItem('buildbuddy_session_id', sessionId);

                await supabase
                    .from('usersession')
                    .insert({
                        session_id: sessionId,
                        session_start: new Date().toISOString()
                    });
            } else {
                const existingSession = await supabase
                    .from('usersession')
                    .select('session_id')
                    .eq('session_id', sessionId)
                    .maybeSingle();

                if (!existingSession?.data) {
                    await supabase
                        .from('usersession')
                        .insert({
                            session_id: sessionId,
                            session_start: new Date().toISOString()
                        });
                }
            }

            this.currentSessionId = sessionId;

            const cartPromise = this.getOrCreateCart();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Cart creation timed out')), 5000);
            });

            try {
                await Promise.race([cartPromise, timeoutPromise]);
            } catch {
                await this.getOrCreateCart();
            }

            this.isInitialized = true;
            return this.currentSessionId;

        } catch (error) {
            console.error('Session init error:', error);
            this.isInitialized = false;
            return null;
        }
    }

    generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async ensureInitialized() {
        if (this.isInitialized && this.currentSessionId) {
            return true;
        }

        if (this.initPromise) {
            try {
                await this.initPromise;
                return true;
            } catch {
                return false;
            }
        }

        try {
            await this.initSession();
            return this.isInitialized;
        } catch {
            return false;
        }
    }

    async getOrCreateCart() {
        try {
            if (!this.currentSessionId) {
                await this.initSession();
                if (!this.currentSessionId) {
                    return null;
                }
            }

            const cartsResult = await supabase
                .from('cart')
                .select('cart_id')
                .eq('session_id', this.currentSessionId)
                .order('cart_id', { ascending: false })
                .limit(1);

            const carts = cartsResult?.data || [];

            if (carts && carts.length > 0) {
                this.currentCartId = carts[0].cart_id;
            } else {
                const insertResult = await supabase
                    .from('cart')
                    .insert({
                        session_id: this.currentSessionId
                    })
                    .select()
                    .maybeSingle();

                if (insertResult?.data) {
                    this.currentCartId = insertResult.data.cart_id;
                } else {
                    await supabase
                        .from('cart')
                        .insert({
                            session_id: this.currentSessionId
                        });

                    const retryResult = await supabase
                        .from('cart')
                        .select('cart_id')
                        .eq('session_id', this.currentSessionId)
                        .order('cart_id', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (retryResult?.data) {
                        this.currentCartId = retryResult.data.cart_id;
                    } else {
                        this.currentCartId = null;
                    }
                }
            }

            return this.currentCartId;

        } catch (error) {
            console.error('Get or create cart error:', error);
            return null;
        }
    }

    async getInventory(category = null) {
        try {
            await this.ensureInitialized();

            let query = supabase
                .from('inventory')
                .select('*')
                .gt('i_quantity', 0)
                .order('i_category')
                .order('i_price');

            if (category && category !== 'all') {
                query = query.eq('i_category', category);
            }

            const result = await query;
            return result?.data || [];
        } catch (error) {
            console.error('Get inventory error:', error);
            return [];
        }
    }

    async getInventoryById(itemId) {
        try {
            await this.ensureInitialized();

            const result = await supabase
                .from('inventory')
                .select('*')
                .eq('i_id', itemId)
                .maybeSingle();

            return result?.data || null;
        } catch (error) {
            console.error('Get inventory by id error:', error);
            return null;
        }
    }

    async getServices() {
        try {
            await this.ensureInitialized();

            const result = await supabase
                .from('service')
                .select('*')
                .order('service_category')
                .order('service_price');

            return result?.data || [];
        } catch (error) {
            console.error('Get services error:', error);
            return [];
        }
    }

    async getServiceOrdersForSession(sessionId) {
        try {
            const { data, error } = await supabase
                .from('service_orders')
                .select('*')
                .eq('session_id', sessionId)
                .eq('order_status', 'PENDING')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching service orders:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error fetching service orders:', error);
            return [];
        }
    }

    async addToCart(itemId, quantity = 1) {
        try {
            await this.ensureInitialized();

            if (!this.currentCartId) {
                await this.getOrCreateCart();
            }

            if (!this.currentCartId) {
                throw new Error('No cart available');
            }

            const item = await this.getInventoryById(itemId);
            if (!item) throw new Error('Item not found');

            const totalPrice = item.i_price * quantity;

            const existingResult = await supabase
                .from('cart_items')
                .select('*')
                .eq('cart_id', this.currentCartId)
                .eq('i_id', itemId)
                .maybeSingle();

            if (existingResult?.data) {
                const newQuantity = existingResult.data.quantity + quantity;
                const newTotal = item.i_price * newQuantity;

                return await supabase
                    .from('cart_items')
                    .eq('ci_id', existingResult.data.ci_id)
                    .update({
                        quantity: newQuantity,
                        total_price: newTotal
                    });
            } else {
                return await supabase
                    .from('cart_items')
                    .insert({
                        cart_id: this.currentCartId,
                        i_id: itemId,
                        quantity: quantity,
                        total_price: totalPrice
                    });
            }
        } catch (error) {
            console.error('Add to cart error:', error);
            throw error;
        }
    }

    async addServiceToCart(serviceId) {
        try {
            await this.ensureInitialized();

            if (!this.currentCartId) {
                await this.getOrCreateCart();
            }

            if (!this.currentCartId) {
                throw new Error('No cart available');
            }

            const existingResult = await supabase
                .from('cart_service')
                .select('*')
                .eq('cart_id', this.currentCartId)
                .eq('service_id', serviceId)
                .maybeSingle();

            if (!existingResult?.data) {
                return await supabase
                    .from('cart_service')
                    .insert({
                        cart_id: this.currentCartId,
                        service_id: serviceId
                    });
            }

            return existingResult;
        } catch (error) {
            console.error('Add service to cart error:', error);
            throw error;
        }
    }

    async getCartItems() {
        try {
            await this.ensureInitialized();

            if (!this.currentCartId) {
                return [];
            }

            const result = await supabase
                .from('cart_items')
                .select(`
                    ci_id,
                    quantity,
                    total_price,
                    i_id
                `)
                .eq('cart_id', this.currentCartId);

            return result?.data || [];
        } catch (error) {
            console.error('Get cart items error:', error);
            return [];
        }
    }

    async getCartServices() {
        try {
            await this.ensureInitialized();

            if (!this.currentCartId) {
                return [];
            }

            const result = await supabase
                .from('cart_service')
                .select(`
                    cs_id,
                    cart_id,
                    service_id
                `)
                .eq('cart_id', this.currentCartId);

            const cartServices = result?.data || [];

            if (cartServices.length === 0) {
                return [];
            }

            const serviceIds = cartServices.map(item => item.service_id).filter(id => id !== null);

            if (serviceIds.length === 0) {
                return cartServices;
            }

            const servicesResult = await supabase
                .from('service')
                .select('*')
                .in('service_id', serviceIds);

            const services = servicesResult?.data || [];

            const serviceMap = {};
            services.forEach(s => {
                serviceMap[s.service_id] = s;
            });

            return cartServices.map(item => ({
                ...item,
                service: serviceMap[item.service_id] || null,
                name: serviceMap[item.service_id]?.service_name || 'Service #' + item.service_id,
                price: serviceMap[item.service_id]?.service_price || 0,
                duration: serviceMap[item.service_id]?.service_duration || null,
                category: serviceMap[item.service_id]?.service_category || null
            }));
        } catch (error) {
            console.error('Get cart services error:', error);
            return [];
        }
    }

    async updateCartItemQuantity(cartItemId, quantity) {
        try {
            await this.ensureInitialized();

            const cartItemResult = await supabase
                .from('cart_items')
                .select('i_id')
                .eq('ci_id', cartItemId)
                .maybeSingle();

            if (cartItemResult?.data) {
                const product = await this.getInventoryById(cartItemResult.data.i_id);
                if (product) {
                    const totalPrice = product.i_price * quantity;
                    return await supabase
                        .from('cart_items')
                        .eq('ci_id', cartItemId)
                        .update({
                            quantity: quantity,
                            total_price: totalPrice
                        });
                }
            }
            return null;
        } catch (error) {
            console.error('Update cart item quantity error:', error);
            throw error;
        }
    }

    async removeCartItem(cartItemId) {
        try {
            await this.ensureInitialized();
            return await supabase
                .from('cart_items')
                .delete()
                .eq('ci_id', cartItemId);
        } catch (error) {
            console.error('Remove cart item error:', error);
            throw error;
        }
    }

    async removeCartService(cartServiceId) {
        try {
            await this.ensureInitialized();
            return await supabase
                .from('cart_service')
                .delete()
                .eq('cs_id', cartServiceId);
        } catch (error) {
            console.error('Remove cart service error:', error);
            throw error;
        }
    }

    async createPayment(paymentMethod) {
        try {
            await this.ensureInitialized();

            const cartItems = await this.getCartItems();
            const cartServices = await this.getCartServices();

            let totalAmount = 0;

            for (const item of cartItems) {
                totalAmount += parseFloat(item.total_price || 0);
            }

            for (const cs of cartServices) {
                const serviceResult = await supabase
                    .from('service')
                    .select('service_price')
                    .eq('service_id', cs.service_id)
                    .maybeSingle();

                if (serviceResult?.data) {
                    totalAmount += parseFloat(serviceResult.data.service_price || 0);
                }
            }

            return await supabase
                .from('payment')
                .insert({
                    session_id: this.currentSessionId,
                    cart_id: this.currentCartId,
                    total_amount: totalAmount,
                    payment_method: paymentMethod,
                    payment_status: 'PENDING'
                });
        } catch (error) {
            console.error('Create payment error:', error);
            throw error;
        }
    }

    async updatePaymentStatus(paymentId, status) {
        try {
            await this.ensureInitialized();
            return await supabase
                .from('payment')
                .update({ payment_status: status })
                .eq('payment_id', paymentId);
        } catch (error) {
            console.error('Update payment status error:', error);
            throw error;
        }
    }

    async endSession() {
        try {
            if (this.currentSessionId) {
                await supabase
                    .from('usersession')
                    .update({ session_end: new Date().toISOString() })
                    .eq('session_id', this.currentSessionId);

                localStorage.removeItem('buildbuddy_session_id');
                this.currentSessionId = null;
                this.currentCartId = null;
                this.isInitialized = false;
                this.initPromise = null;
            }
        } catch (error) {
            console.error('End session error:', error);
        }
    }

    async createNewCart() {
        try {
            const user = getCurrentUser();
            const userId = user ? (user.user_id || user.id) : null;

            // Get or create session
            let sessionId = localStorage.getItem('buildbuddy_session_id');
            if (!sessionId) {
                sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('buildbuddy_session_id', sessionId);
            }

            // Ensure session exists
            const { data: existingSession } = await supabase
                .from('usersession')
                .select('session_id')
                .eq('session_id', sessionId)
                .maybeSingle();

            if (!existingSession) {
                await supabase
                    .from('usersession')
                    .insert({
                        session_id: sessionId,
                        session_start: new Date().toISOString()
                    });
            }

            // Create new cart
            const cartData = {
                session_id: sessionId,
                user_id: userId,
                cart_date: new Date().toISOString()
            };

            const { data: newCart, error: cartError } = await supabase
                .from('cart')
                .insert(cartData)
                .select()
                .single();

            if (cartError) {
                console.error('❌ Error creating new cart:', cartError);
                throw cartError;
            }

            // Update local state
            this.currentCartId = newCart.cart_id;

            // Store in localStorage for persistence
            localStorage.setItem('buildbuddy_current_cart_id', String(newCart.cart_id));

            console.log('✅ New cart created:', newCart);
            return newCart;

        } catch (error) {
            console.error('❌ Error creating new cart:', error);
            throw error;
        }
    }
    async hasCartItems() {
        const items = await this.getCartItems();
        return items && items.length > 0;
    }

    async getCartCount() {
        const items = await this.getCartItems();
        const services = await this.getCartServices();
        return (items?.length || 0) + (services?.length || 0);
    }

    async clearCart(cartId) {
        try {
            if (!cartId) {
                cartId = this.currentCartId;
            }

            if (!cartId) {
                console.warn('⚠️ No cart ID to clear');
                return;
            }

            // Delete all cart items
            const { error: itemsError } = await supabase
                .from('cart_items')
                .delete()
                .eq('cart_id', cartId);

            if (itemsError) {
                console.error('❌ Error clearing cart items:', itemsError);
            }

            // Delete all cart services
            const { error: servicesError } = await supabase
                .from('cart_service')
                .delete()
                .eq('cart_id', cartId);

            if (servicesError) {
                console.error('❌ Error clearing cart services:', servicesError);
            }

            console.log('✅ Cart cleared:', cartId);
            return true;

        } catch (error) {
            console.error('❌ Error clearing cart:', error);
            return false;
        }
    }
}

const dataService = new DataService();
export default dataService;