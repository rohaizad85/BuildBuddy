import supabase from './supabase-client.js';

class DataService {
    constructor() {
        this.currentSessionId = null;
        this.currentCartId = null;
        this.initSession();
    }

    async initSession() {
        try {
            let sessionId = localStorage.getItem('buildbuddy_session_id');
            
            if (!sessionId) {
                sessionId = this.generateSessionId();
                localStorage.setItem('buildbuddy_session_id', sessionId);
                
                console.log('Creating new session:', sessionId);
                
                // Create session first
                const sessionResult = await supabase
                    .from('usersession')
                    .insert({
                        session_id: sessionId,
                        session_start: new Date().toISOString()
                    });
                
                console.log('Session created:', sessionResult);
            } else {
                console.log('Existing session found:', sessionId);
                
                // Verify session exists in database
                const existingSession = await supabase
                    .from('usersession')
                    .select('session_id')
                    .eq('session_id', sessionId);
                
                if (!existingSession || existingSession.length === 0) {
                    console.log('Session not found in DB, recreating...');
                    
                    await supabase
                        .from('usersession')
                        .insert({
                            session_id: sessionId,
                            session_start: new Date().toISOString()
                        });
                }
            }
            
            this.currentSessionId = sessionId;
            
            // Now create or get cart
            await this.getOrCreateCart();
            
            console.log('Session initialized. Session ID:', this.currentSessionId, 'Cart ID:', this.currentCartId);
            
        } catch (error) {
            console.error('Session init error:', error);
        }
    }

    generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async getOrCreateCart() {
    try {
        if (!this.currentSessionId) {
            console.error('No session ID available for cart creation');
            return null;
        }
        
        // Get the LATEST cart for this session (not the first)
        const carts = await supabase
            .from('cart')
            .select('cart_id')
            .eq('session_id', this.currentSessionId)
            .order('cart_id', 'desc');  // Get newest first
        
        console.log('Existing carts:', carts);
        
        if (carts && carts.length > 0) {
            // Use the LATEST cart
            this.currentCartId = carts[0].cart_id;
            console.log('Using latest cart:', this.currentCartId);
        } else {
            // Create new cart
            console.log('Creating new cart for session:', this.currentSessionId);
            
            const newCart = await supabase
                .from('cart')
                .insert({
                    session_id: this.currentSessionId
                });
            
            if (newCart && newCart.length > 0) {
                this.currentCartId = newCart[0].cart_id;
            } else {
                const createdCart = await supabase
                    .from('cart')
                    .select('cart_id')
                    .eq('session_id', this.currentSessionId)
                    .order('cart_id', 'desc');
                
                if (createdCart && createdCart.length > 0) {
                    this.currentCartId = createdCart[0].cart_id;
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
            let query = supabase
                .from('inventory')
                .select('*')
                .gt('i_quantity', 0)
                .order('i_category')
                .order('i_price');
            
            if (category && category !== 'all') {
                query = query.eq('i_category', category);
            }
            
            const data = await query;
            console.log('Inventory loaded:', data?.length || 0, 'items');
            return data || [];
        } catch (error) {
            console.error('Get inventory error:', error);
            return [];
        }
    }

    async getInventoryById(itemId) {
        try {
            const items = await supabase
                .from('inventory')
                .select('*')
                .eq('i_id', itemId);
            
            return items && items.length > 0 ? items[0] : null;
        } catch (error) {
            console.error('Get inventory by id error:', error);
            return null;
        }
    }

    async getServices() {
        try {
            const data = await supabase
                .from('service')
                .select('*')
                .order('service_category')
                .order('service_price');
            
            console.log('Services loaded:', data?.length || 0, 'services');
            return data || [];
        } catch (error) {
            console.error('Get services error:', error);
            return [];
        }
    }

    async addToCart(itemId, quantity = 1) {
    try {
        await this.getOrCreateCart();
        
        if (!this.currentCartId) {
            console.error('No cart available, creating new one...');
            await this.initSession();
        }
        
        if (!this.currentCartId) {
            throw new Error('No cart available');
        }
        
        const item = await this.getInventoryById(itemId);
        if (!item) throw new Error('Item not found');
        
        const totalPrice = item.i_price * quantity;
        
        // Check if item already exists in cart
        const existingItem = await supabase
            .from('cart_items')
            .select('*')
            .eq('cart_id', this.currentCartId)
            .eq('i_id', itemId);
        
        if (existingItem && existingItem.length > 0) {
            const newQuantity = existingItem[0].quantity + quantity;
            const newTotal = item.i_price * newQuantity;
            
            // FIXED: Use .eq() BEFORE .update()
            return await supabase
                .from('cart_items')
                .eq('ci_id', existingItem[0].ci_id)
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
            await this.getOrCreateCart();
            
            if (!this.currentCartId) {
                console.error('No cart available, creating new one...');
                await this.initSession();
            }
            
            if (!this.currentCartId) {
                throw new Error('No cart available');
            }
            
            const existingService = await supabase
                .from('cart_service')
                .select('*')
                .eq('cart_id', this.currentCartId)
                .eq('service_id', serviceId);
            
            if (existingService && existingService.length === 0) {
                return await supabase
                    .from('cart_service')
                    .insert({
                        cart_id: this.currentCartId,
                        service_id: serviceId
                    });
            }
            
            return existingService;
        } catch (error) {
            console.error('Add service to cart error:', error);
            throw error;
        }
    }

    async getCartItems() {
        try {
            if (!this.currentCartId) return [];
            
            const items = await supabase
                .from('cart_items')
                .select(`
                    ci_id,
                    quantity,
                    total_price,
                    i_id
                `)
                .eq('cart_id', this.currentCartId);
            
            return items || [];
        } catch (error) {
            console.error('Get cart items error:', error);
            return [];
        }
    }

    async getCartServices() {
        try {
            if (!this.currentCartId) return [];
            
            const services = await supabase
                .from('cart_service')
                .select(`
                    cs_id,
                    service_id
                `)
                .eq('cart_id', this.currentCartId);
            
            return services || [];
        } catch (error) {
            console.error('Get cart services error:', error);
            return [];
        }
    }

    async updateCartItemQuantity(cartItemId, quantity) {
    try {
        const item = await this.getInventoryById(cartItemId);
        // Actually need to get the product ID from cart_items first
        const cartItem = await supabase
            .from('cart_items')
            .select('i_id')
            .eq('ci_id', cartItemId)
            .single();
        
        if (cartItem) {
            const product = await this.getInventoryById(cartItem.i_id);
            const totalPrice = product.i_price * quantity;
            
            return await supabase
                .from('cart_items')
                .eq('ci_id', cartItemId)
                .update({
                    quantity: quantity,
                    total_price: totalPrice
                });
        }
    } catch (error) {
        console.error('Update cart item quantity error:', error);
        throw error;
    }
}

    async removeCartItem(cartItemId) {
        try {
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
            const cartItems = await this.getCartItems();
            const cartServices = await this.getCartServices();
            
            let totalAmount = 0;
            for (const item of cartItems) {
                totalAmount += parseFloat(item.total_price || 0);
            }
            for (const cs of cartServices) {
                const serviceData = await supabase
                    .from('service')
                    .select('service_price')
                    .eq('service_id', cs.service_id);
                
                if (serviceData && serviceData.length > 0) {
                    totalAmount += parseFloat(serviceData[0].service_price);
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
            }
        } catch (error) {
            console.error('End session error:', error);
        }
    }

    async createNewCart() {
    try {
        if (!this.currentSessionId) {
            console.error('No session ID for new cart');
            return null;
        }
        
        console.log('Creating new cart for session:', this.currentSessionId);
        
        const newCart = await supabase
            .from('cart')
            .insert({
                session_id: this.currentSessionId
            });
        
        if (newCart && newCart.length > 0) {
            this.currentCartId = newCart[0].cart_id;
        } else {
            const created = await supabase
                .from('cart')
                .select('cart_id')
                .eq('session_id', this.currentSessionId)
                .order('cart_id', 'desc');
            
            if (created && created.length > 0) {
                this.currentCartId = created[0].cart_id;
            }
        }
        
        console.log('New cart created:', this.currentCartId);
        return this.currentCartId;
        
    } catch (error) {
        console.error('Create new cart error:', error);
        return null;
    }
}
}

const dataService = new DataService();
export default dataService;