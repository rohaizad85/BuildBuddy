// receipt.js - PDF Receipt Generator for BuildBuddy
// Usage: import { downloadReceipt } from './receipt.js';
//        downloadReceipt(orderData, userData);

/**
 * Generates and downloads a professional PDF receipt
 * @param {Object} order - Order data with items, payment info
 * @param {Object} user - User data with name, email, phone, address
 */
export function downloadReceipt(order, user) {
    const receiptId = 'BB-' + String(order.payment_id || order.order_id || Date.now()).padStart(6, '0');
    const fullDate = order.payment_date ? new Date(order.payment_date).toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' });
    const time = order.payment_date ? new Date(order.payment_date).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
    const paymentMethod = order.payment_method === 'cash' ? 'Cash on Delivery' : 'Online Payment';
    const status = order.payment_status || 'PENDING';
    const total = parseFloat(order.total_amount || 0).toFixed(2);
    
    // Get user details - prioritize shipping data from order first
    // This ensures the shipping address entered at checkout is used
    const userName = order.shipping_name || user.full_name || user.name || 'Customer';
    const userEmail = order.shipping_email || user.email || '';
    const userPhone = order.shipping_phone || user.phone || user.contact_phone || '';
    const userAddress = order.shipping_address || user.address || user.shipping_address || user.customer_address || '';
    const membershipLevel = user.membership_level || user.tier || 'Standard';
    const discountRate = user.discount_rate || 0;
    
    console.log('📋 Receipt user data:', { 
        userName, 
        userEmail, 
        userPhone, 
        userAddress, 
        membershipLevel, 
        discountRate,
        orderShippingName: order.shipping_name,
        orderShippingAddress: order.shipping_address
    });
    
    // Calculate discount if applicable
    let discountAmount = 0;
    let discountLabel = '';
    let subtotal = parseFloat(order.subtotal || order.total_amount || 0);
    
    if (order.discount_amount) {
        discountAmount = parseFloat(order.discount_amount);
        discountLabel = order.discount_label || 'Discount';
    } else if (discountRate > 0) {
        discountAmount = subtotal * (discountRate / 100);
        discountLabel = `${membershipLevel} Member Discount (${discountRate}%)`;
    }
    
    // Check if jsPDF is available, load dynamically if not
    if (typeof window.jspdf === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => generatePDF();
        document.head.appendChild(script);
    } else {
        generatePDF();
    }
    
    function generatePDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);
        let yPos = margin;
        let currentPage = 1;
        let totalPages = 1;
        
        // ===== HEADER BAR =====
        doc.setFillColor(0, 212, 255);
        doc.rect(0, 0, pageWidth, 35, 'F');
        
        // BuildBuddy Logo Text
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('BuildBuddy', margin, 20);
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text('OFFICIAL RECEIPT', pageWidth - margin, 20, { align: 'right' });
        
        doc.setFontSize(8);
        doc.text('staff@buildbuddy.com | +60 12-345 6789', margin, 28);
        
        yPos = 45;
        
        // ===== RECEIPT TITLE =====
        doc.setTextColor(26, 26, 46);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('RECEIPT', margin, yPos);
        
        yPos += 10;
        
        // ===== ORDER INFO BOX =====
        doc.setDrawColor(0, 212, 255);
        doc.setFillColor(245, 252, 255);
        doc.roundedRect(margin, yPos, contentWidth, 32, 3, 3, 'FD');
        
        const labelX = margin + 5;
        const valueX = margin + 50;
        
        doc.setTextColor(26, 26, 46);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Receipt ID:', labelX, yPos + 8);
        doc.text('Order Ref:', labelX, yPos + 18);
        doc.text('Date:', labelX, yPos + 28);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 51, 51);
        doc.text(`#${receiptId}`, valueX, yPos + 8);
        doc.text(`#${order.payment_id || order.order_id}`, valueX, yPos + 18);
        doc.text(`${fullDate} at ${time}`, valueX, yPos + 28);
        
        yPos += 40;
        
        // ===== BILL TO / SHIPPING ADDRESS =====
        doc.setTextColor(26, 26, 46);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Bill To / Shipping Address', margin, yPos);
        
        yPos += 10;
        
        doc.setTextColor(51, 51, 51);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        // Name
        if (userName) {
            doc.text(userName, margin, yPos);
            yPos += 6;
        }
        
        // Email
        if (userEmail) {
            doc.text(userEmail, margin, yPos);
            yPos += 6;
        }
        
        // Phone
        if (userPhone) {
            doc.text(userPhone, margin, yPos);
            yPos += 6;
        }
        
        // Address - wrap long addresses
        if (userAddress) {
            const addressLines = doc.splitTextToSize(userAddress, contentWidth - 10);
            addressLines.forEach(line => {
                doc.text(line, margin, yPos);
                yPos += 6;
            });
        } else {
            doc.setTextColor(136, 136, 136);
            doc.setFontSize(9);
            doc.text('No shipping address provided', margin, yPos);
            doc.setTextColor(51, 51, 51);
            doc.setFontSize(10);
            yPos += 6;
        }
        
        yPos += 4;
        
        // ===== PAYMENT INFO =====
        doc.setTextColor(26, 26, 46);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Payment Method:', labelX, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 51, 51);
        doc.text(paymentMethod, valueX, yPos);
        yPos += 7;
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 26, 46);
        doc.text('Status:', labelX, yPos);
        doc.setFont('helvetica', 'normal');
        if (status === 'PAID' || status === 'COMPLETED') {
            doc.setTextColor(76, 175, 80);
        } else {
            doc.setTextColor(255, 152, 0);
        }
        doc.text(status === 'PAID' || status === 'COMPLETED' ? 'Paid' : 'Pending', valueX, yPos);
        
        yPos += 12;
        
        // Separator line
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;
        
        // ===== ITEMS TABLE =====
        doc.setTextColor(26, 26, 46);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Order Details', margin, yPos);
        
        yPos += 10;
        
        // Table header - Adjusted widths for better alignment
        const colWidths = {
            item: contentWidth * 0.45,
            qty: contentWidth * 0.10,
            price: contentWidth * 0.20,
            total: contentWidth * 0.25
        };
        
        // Column X positions
        const colItemX = margin;
        const colQtyX = margin + colWidths.item;
        const colPriceX = margin + colWidths.item + colWidths.qty;
        const colTotalX = margin + colWidths.item + colWidths.qty + colWidths.price;
        
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPos, contentWidth, 8, 'F');
        
        doc.setTextColor(26, 26, 46);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        
        doc.text('Item', colItemX + 2, yPos + 6);
        doc.text('Qty', colQtyX + (colWidths.qty / 2), yPos + 6, { align: 'center' });
        doc.text('Unit Price', colPriceX + colWidths.price, yPos + 6, { align: 'right' });
        doc.text('Amount', colTotalX + colWidths.total, yPos + 6, { align: 'right' });
        
        yPos += 12;
        
        // Table rows with image support
        doc.setTextColor(51, 51, 51);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const items = order.items || [];
        let totalItems = 0;
        let subtotalAmount = 0;
        
        if (items.length > 0) {
            items.forEach((item, index) => {
                // Check if we need a new page
                if (yPos > 250) {
                    doc.addPage();
                    yPos = margin;
                    currentPage++;
                    totalPages++;
                    
                    // Re-draw header on new page
                    doc.setFillColor(0, 212, 255);
                    doc.rect(0, 0, pageWidth, 25, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(14);
                    doc.setFont('helvetica', 'bold');
                    doc.text('BuildBuddy - Receipt', margin, 15);
                    doc.setFontSize(8);
                    doc.text(`Page ${currentPage}`, pageWidth - margin, 15, { align: 'right' });
                    
                    yPos = 35;
                    
                    // Re-draw table header
                    doc.setFillColor(245, 245, 245);
                    doc.rect(margin, yPos, contentWidth, 8, 'F');
                    doc.setTextColor(26, 26, 46);
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Item', colItemX + 2, yPos + 6);
                    doc.text('Qty', colQtyX + (colWidths.qty / 2), yPos + 6, { align: 'center' });
                    doc.text('Unit Price', colPriceX + colWidths.price, yPos + 6, { align: 'right' });
                    doc.text('Amount', colTotalX + colWidths.total, yPos + 6, { align: 'right' });
                    yPos += 12;
                }
                
                // Alternating row background
                if (index % 2 === 0) {
                    doc.setFillColor(250, 250, 250);
                    doc.rect(margin, yPos - 3, contentWidth, 8, 'F');
                }
                
                const itemPrefix = item.type === 'service' ? '[Service] ' : (item.type === 'bundle' ? '[Bundle] ' : '');
                const itemName = itemPrefix + (item.name || 'Item');
                const itemQty = item.quantity || 1;
                const itemPrice = parseFloat(item.price || 0);
                const itemTotal = parseFloat(item.total || itemPrice * itemQty);
                
                subtotalAmount += itemTotal;
                totalItems += itemQty;
                
                // Item name with wrapping
                const nameLines = doc.splitTextToSize(itemName, colWidths.item - 4);
                doc.text(nameLines[0], colItemX + 2, yPos);
                
                // Quantity - center aligned
                doc.text(String(itemQty), colQtyX + (colWidths.qty / 2), yPos, { align: 'center' });
                
                // Unit Price - right aligned
                doc.text(`RM ${itemPrice.toFixed(2)}`, colPriceX + colWidths.price, yPos, { align: 'right' });
                
                // Amount - right aligned
                doc.text(`RM ${itemTotal.toFixed(2)}`, colTotalX + colWidths.total, yPos, { align: 'right' });
                
                yPos += 7;
            });
        } else {
            doc.text('No items listed', colItemX + 2, yPos);
            yPos += 7;
        }
        
        yPos += 5;
        
        // Separator before totals
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;
        
        // ===== TOTALS SECTION =====
        const totalsLabelX = pageWidth * 0.55;
        const totalsValueX = pageWidth - margin;
        
        // Subtotal
        doc.setTextColor(51, 51, 51);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Subtotal:', totalsLabelX, yPos);
        doc.text(`RM ${subtotalAmount.toFixed(2)}`, totalsValueX, yPos, { align: 'right' });
        yPos += 8;
        
        // Show discount if applicable
        let finalTotal = subtotalAmount;
        if (discountAmount > 0) {
            finalTotal = subtotalAmount - discountAmount;
            doc.setTextColor(76, 175, 80);
            doc.setFont('helvetica', 'italic');
            doc.text(`${discountLabel}:`, totalsLabelX, yPos);
            doc.text(`- RM ${discountAmount.toFixed(2)}`, totalsValueX, yPos, { align: 'right' });
            yPos += 8;
        }
        
        // Shipping if applicable
        let shippingCost = 0;
        if (order.shipping_cost) {
            shippingCost = parseFloat(order.shipping_cost);
            finalTotal += shippingCost;
            doc.setTextColor(51, 51, 51);
            doc.setFont('helvetica', 'normal');
            doc.text('Shipping:', totalsLabelX, yPos);
            doc.text(`RM ${shippingCost.toFixed(2)}`, totalsValueX, yPos, { align: 'right' });
            yPos += 8;
        }
        
        // Tax if applicable
        let taxAmount = 0;
        if (order.tax_amount) {
            taxAmount = parseFloat(order.tax_amount);
            finalTotal += taxAmount;
            doc.setTextColor(51, 51, 51);
            doc.setFont('helvetica', 'normal');
            doc.text('Tax (SST):', totalsLabelX, yPos);
            doc.text(`RM ${taxAmount.toFixed(2)}`, totalsValueX, yPos, { align: 'right' });
            yPos += 8;
        }
        
        // Separator before final total
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 8;
        
        // Final Total
        doc.setTextColor(26, 26, 46);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL:', totalsLabelX, yPos);
        doc.text(`RM ${finalTotal.toFixed(2)}`, totalsValueX, yPos, { align: 'right' });
        
        yPos += 10;
        
        // ===== MEMBERSHIP INFO =====
        if (membershipLevel && membershipLevel !== 'Standard' && discountAmount > 0) {
            doc.setTextColor(0, 212, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            const membershipText = `🏆 ${membershipLevel} Member - You saved RM ${discountAmount.toFixed(2)} with this purchase!`;
            doc.text(membershipText, pageWidth / 2, yPos, { align: 'center' });
            yPos += 10;
        }
        
        // ===== FOOTER =====
        doc.setDrawColor(0, 212, 255);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        
        yPos += 10;
        
        doc.setTextColor(136, 136, 136);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        
        const footerTexts = [
            'Thank you for shopping with BuildBuddy!',
            'This is a computer-generated receipt and does not require a signature.',
            'For inquiries: support@buildbuddy.my | +60 12-345 6789',
            'BuildBuddy - Your Trusted PC Building Companion'
        ];
        
        footerTexts.forEach(text => {
            const textWidth = doc.getStringUnitWidth(text) * 8 / doc.internal.scaleFactor;
            const x = (pageWidth - textWidth) / 2;
            doc.text(text, x, yPos);
            yPos += 5;
        });
        
        // Page numbers
        if (totalPages > 1) {
            doc.setFontSize(8);
            doc.setTextColor(136, 136, 136);
            const pageText = `Page ${currentPage} of ${totalPages}`;
            doc.text(pageText, pageWidth - margin, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
        }
        
        // Save PDF
        doc.save(`BuildBuddy_Receipt_${receiptId}.pdf`);
    }
}

/**
 * Gets user data from localStorage/sessionStorage
 * @returns {Object|null} User data object
 */
export function getCurrentUser() {
    const data = localStorage.getItem('buildbuddy_user') || sessionStorage.getItem('buildbuddy_user');
    if (!data) return null;
    try {
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
}

/**
 * Fetches user data from Supabase with membership info
 * @param {string} userId - User ID
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<Object>} User data with membership
 */
export async function fetchUserWithMembership(userId, supabase) {
    if (!userId || !supabase) return null;
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select(`
                user_id,
                full_name,
                email,
                phone,
                address,
                membership_level,
                discount_rate
            `)
            .eq('user_id', userId)
            .single();
        
        if (error) {
            console.error('Error fetching user data:', error);
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('Error in fetchUserWithMembership:', error);
        return null;
    }
}

/**
 * Generates a receipt with all order data including membership discounts
 * @param {Object} order - Full order object with items and payment
 * @param {Object} user - User object with membership info
 * @param {Object} supabase - Supabase client
 */
export async function generateReceiptWithMembership(order, user, supabase) {
    try {
        // If user has ID but no membership data, fetch it
        let userData = user;
        if (user && user.user_id && !user.membership_level) {
            const fullUser = await fetchUserWithMembership(user.user_id, supabase);
            if (fullUser) {
                userData = { ...user, ...fullUser };
            }
        }
        
        // Calculate membership discount if applicable
        let discountAmount = 0;
        let discountLabel = '';
        const subtotal = parseFloat(order.subtotal || order.total_amount || 0);
        
        if (userData && userData.membership_level && userData.membership_level !== 'Standard') {
            const discountRate = userData.discount_rate || 0;
            if (discountRate > 0) {
                discountAmount = subtotal * (discountRate / 100);
                discountLabel = `${userData.membership_level} Member Discount (${discountRate}%)`;
            }
        }
        
        // Add discount to order object for receipt generation
        const enhancedOrder = {
            ...order,
            discount_amount: discountAmount,
            discount_label: discountLabel,
            subtotal: subtotal
        };
        
        downloadReceipt(enhancedOrder, userData);
        
        return enhancedOrder;
    } catch (error) {
        console.error('Error generating receipt with membership:', error);
        downloadReceipt(order, user);
        return order;
    }
}

// Utility function to format currency
function formatCurrency(amount) {
    return `RM ${parseFloat(amount || 0).toFixed(2)}`;
}