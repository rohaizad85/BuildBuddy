// receipt.js - PDF Receipt Generator for BuildBuddy
// Usage: import { downloadReceipt } from './receipt.js';
//        downloadReceipt(orderData, userData);

/**
 * Generates and downloads a professional PDF receipt
 * @param {Object} order - Order data with items, payment info
 * @param {Object} user - User data with name, email, phone, address
 */
export function downloadReceipt(order, user) {
    const receiptId = 'BB-' + String(order.payment_id).padStart(6, '0');
    const fullDate = order.payment_date ? new Date(order.payment_date).toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    const time = order.payment_date ? new Date(order.payment_date).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) : '';
    const paymentMethod = order.payment_method === 'cash' ? 'Cash on Delivery' : 'Online Payment';
    const status = order.payment_status || 'PENDING';
    const total = parseFloat(order.total_amount || 0).toFixed(2);
    
    // Get user details - check multiple possible field names
    const userName = user.full_name || user.name || 'Customer';
    const userEmail = user.email || '';
    const userPhone = user.phone || '';
    const userAddress = user.address || user.shipping_address || '';
    
    console.log('Receipt user data:', { userName, userEmail, userPhone, userAddress });
    
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
        
        // ===== HEADER BAR =====
        doc.setFillColor(0, 212, 255);
        doc.rect(0, 0, pageWidth, 35, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('BuildBuddy', margin, 20);
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text('OFFICIAL RECEIPT', pageWidth - margin, 20, { align: 'right' });
        
        doc.setFontSize(8);
        doc.text('support@buildbuddy.my | +60 12-345 6789', margin, 28);
        
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
        doc.text(`#${order.payment_id}`, valueX, yPos + 18);
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
        if (status === 'PAID') {
            doc.setTextColor(76, 175, 80);
        } else {
            doc.setTextColor(255, 152, 0);
        }
        doc.text(status === 'PAID' ? 'Paid' : 'Pending', valueX, yPos);
        
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
        
        // Table header - Adjusted widths for better right alignment
        const colWidths = {
            item: contentWidth * 0.40,
            qty: contentWidth * 0.12,
            price: contentWidth * 0.22,
            total: contentWidth * 0.26
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
        
        // Table rows
        doc.setTextColor(51, 51, 51);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const items = order.items || [];
        
        if (items.length > 0) {
            items.forEach((item, index) => {
                // Check if we need a new page
                if (yPos > 260) {
                    doc.addPage();
                    yPos = margin;
                }
                
                // Alternating row background
                if (index % 2 === 0) {
                    doc.setFillColor(250, 250, 250);
                    doc.rect(margin, yPos - 3, contentWidth, 8, 'F');
                }
                
                const itemPrefix = item.type === 'service' ? '[Service] ' : (item.type === 'bundle' ? '[Bundle] ' : '');
                const itemName = itemPrefix + (item.name || 'Item');
                const nameLines = doc.splitTextToSize(itemName, colWidths.item - 4);
                
                // Item name
                doc.text(nameLines[0], colItemX + 2, yPos);
                
                // Quantity - center aligned
                doc.text(String(item.quantity || 1), colQtyX + (colWidths.qty / 2), yPos, { align: 'center' });
                
                // Unit Price - right aligned
                doc.text(`RM ${parseFloat(item.price || 0).toFixed(2)}`, colPriceX + colWidths.price, yPos, { align: 'right' });
                
                // Amount - right aligned
                const itemTotal = parseFloat(item.total || item.price * (item.quantity || 1)).toFixed(2);
                doc.text(`RM ${itemTotal}`, colTotalX + colWidths.total, yPos, { align: 'right' });
                
                yPos += 7;
            });
        } else {
            doc.text('No items listed', colItemX + 2, yPos);
            yPos += 7;
        }
        
        yPos += 5;
        
        // Separator before total
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;
        
        // ===== TOTAL (right-aligned) =====
        const totalsLabelX = pageWidth * 0.50;
        const totalsValueX = pageWidth - margin;
        
        doc.setTextColor(26, 26, 46);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL:', totalsLabelX, yPos);
        doc.text(`RM ${total}`, totalsValueX, yPos, { align: 'right' });
        
        yPos += 15;
        
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