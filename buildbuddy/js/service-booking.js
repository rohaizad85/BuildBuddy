// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\service-booking.js

import supabase from './supabase-client.js';
import dataService from './data-service.js';
import { initCart } from './cart-utils.js';

let serviceData = null;
let serviceId = null;
let uploadedImages = [];
let isUploading = false;
let currentEditingIndex = null;

const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initCart();

        const urlParams = new URLSearchParams(window.location.search);
        serviceId = urlParams.get('service_id');

        if (!serviceId) {
            showError('No service selected. Please go back and choose a service.');
            return;
        }

        await loadService(serviceId);
        setupForm();
        setMinDate();
        prefillUserData();
        setupImageUpload();
        setupEditor();

    } catch (error) {
        console.error('Error initializing booking:', error);
        showError('Failed to load booking page. Please refresh and try again.');
    }
});

function getServiceImageUrl(service) {
    if (!service) return null;

    let imagePath = service.service_image_path;

    if (!imagePath) {
        const fallbackImages = {
            'Data Recovery': 'Services/Data_Recovery.jpg',
            'OS Installation': 'Services/OS_Install.jpeg',
            'OS Install': 'Services/OS_Install.jpeg',
            'PC Maintenance': 'Services/PC_Maintenance.jpg',
            'Component Upgrade': 'Services/PC_Upgrade.jpg',
            'PC Upgrade': 'Services/PC_Upgrade.jpg',
            'Cable Management': 'Services/Cable_management.jpg'
        };

        if (fallbackImages[service.service_name]) {
            imagePath = fallbackImages[service.service_name];
        } else {
            for (const [key, value] of Object.entries(fallbackImages)) {
                if (service.service_name && service.service_name.toLowerCase().includes(key.toLowerCase())) {
                    imagePath = value;
                    break;
                }
            }
        }

        if (!imagePath) {
            const categoryImages = {
                'repair': 'Services/repair.jpg',
                'recovery': 'Services/Data_Recovery.jpg',
                'software': 'Services/OS_Install.jpeg',
                'maintenance': 'Services/PC_Maintenance.jpg',
                'upgrade': 'Services/PC_Upgrade.jpg',
                'assembly': 'Services/Cable_management.jpg'
            };
            imagePath = categoryImages[service.service_category];
        }

        if (!imagePath) return null;
    }

    return `${SUPABASE_URL}/storage/v1/object/public/images/${imagePath}`;
}

async function loadService(id) {
    try {
        const result = await supabase
            .from('service')
            .select('*')
            .eq('service_id', id)
            .single();

        let data = null;
        let error = null;

        if (Array.isArray(result)) {
            data = result[0] || null;
        } else if (result && typeof result === 'object') {
            if (result.data !== undefined) {
                data = result.data;
                error = result.error || null;
            } else if (result.service_id !== undefined) {
                data = result;
            } else {
                data = result.data || result;
            }
        }

        if (error) {
            throw new Error(error.message || 'Failed to load service');
        }

        if (!data || data.length === 0) {
            throw new Error('Service not found. Please go back and try again.');
        }

        if (Array.isArray(data) && data.length > 0) {
            data = data[0];
        }

        serviceData = data;
        displayServiceSummary(serviceData);

    } catch (error) {
        console.error('Error loading service:', error);
        showError(error.message || 'Failed to load service details. Please refresh the page.');
    }
}

function displayServiceSummary(service) {
    const summary = document.getElementById('serviceSummary');
    if (!summary) return;

    const icon = getServiceIcon(service.service_category);
    const categoryClass = getCategoryClass(service.service_category);
    const imageUrl = getServiceImageUrl(service);

    summary.innerHTML = `
        <div style="display: flex; gap: 20px; flex-wrap: wrap; align-items: center;">
            ${imageUrl ? `
                <div style="width: 120px; height: 120px; border-radius: 12px; overflow: hidden; flex-shrink: 0; background: #f8f9fc; border: 1px solid #e0e0e0;">
                    <img src="${imageUrl}" alt="${service.service_name}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
            ` : `
                <div style="width: 120px; height: 120px; border-radius: 12px; background: #f8f9fc; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid #e0e0e0;">
                    <i class="fas ${icon}" style="font-size: 48px; color: #00d4ff;"></i>
                </div>
            `}
            <div style="flex: 1;">
                <span class="service-category ${categoryClass}" style="display: inline-block; margin-bottom: 4px;">${service.service_category || 'General'}</span>
                <h3 style="margin: 0; color: #1a1a2e;">${service.service_name}</h3>
                <div style="font-size: 14px; color: #666; margin-top: 4px;"><i class="fas fa-clock"></i> ${service.service_duration || 'Contact for duration'}</div>
                <div style="font-size: 22px; font-weight: 700; color: #1a1a2e; margin-top: 4px;">RM ${parseFloat(service.service_price).toFixed(2)}</div>
            </div>
        </div>
    `;
}

function getServiceIcon(category) {
    const icons = {
        'repair': 'fa-tools',
        'assembly': 'fa-computer',
        'upgrade': 'fa-arrow-up',
        'software': 'fa-windows',
        'recovery': 'fa-database',
        'maintenance': 'fa-broom'
    };
    return icons[category] || 'fa-wrench';
}

function getCategoryClass(category) {
    const classes = {
        'repair': 'category-repair',
        'assembly': 'category-assembly',
        'upgrade': 'category-upgrade',
        'software': 'category-software',
        'recovery': 'category-recovery',
        'maintenance': 'category-maintenance'
    };
    return classes[category] || 'category-repair';
}

function setupForm() {
    const form = document.getElementById('bookingForm');
    if (form) {
        form.addEventListener('submit', handleBooking);
    }
}

function setMinDate() {
    const dateInput = document.getElementById('preferredDate');
    if (dateInput) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateInput.min = `${year}-${month}-${day}`;
    }
}

function prefillUserData() {
    try {
        const userData = localStorage.getItem('buildbuddy_user') || sessionStorage.getItem('buildbuddy_user');
        if (userData) {
            const user = JSON.parse(userData);
            const nameInput = document.getElementById('customerName');
            const phoneInput = document.getElementById('contactPhone');

            if (nameInput && user.full_name) {
                nameInput.value = user.full_name;
            }
            if (phoneInput && user.phone) {
                phoneInput.value = user.phone;
            }
        }
    } catch (e) {
        console.warn('Could not prefill user data:', e);
    }
}

// ============================================
// IMAGE EDITOR WITH NAVIGATION & AUTO-SAVE
// ============================================

function setupEditor() {
    const modal = document.getElementById('imageEditorModal');
    const closeBtn = document.querySelector('#imageEditorModal .close-modal');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const saveBtn = document.getElementById('saveImageEditBtn');
    const canvas = document.getElementById('imageEditorCanvas');
    const ctx = canvas.getContext('2d');
    const descriptionInput = document.getElementById('imageDescriptionInput');
    const toggleViewBtn = document.getElementById('toggleViewBtn');
    const prevBtn = document.getElementById('prevImageBtn');
    const nextBtn = document.getElementById('nextImageBtn');
    const imageCounter = document.getElementById('imageCounter');

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentIndex = -1;
    let originalImageData = null;
    let isViewingOriginal = false;
    let isNavigating = false;

    // Undo/Redo state
    let undoStack = [];
    let redoStack = [];
    let isUndoRedoAction = false;
    const MAX_STACK_SIZE = 50;

    // Close modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            autoSaveCurrentImage();
            modal.style.display = 'none';
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            autoSaveCurrentImage();
            modal.style.display = 'none';
        });
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            autoSaveCurrentImage();
            modal.style.display = 'none';
        }
    });

    // Size display
    const sizeSlider = document.getElementById('drawSize');
    const sizeDisplay = document.getElementById('sizeDisplay');
    if (sizeSlider && sizeDisplay) {
        sizeSlider.addEventListener('input', function () {
            sizeDisplay.textContent = this.value + 'px';
        });
    }

    // Auto-save current image state
    function autoSaveCurrentImage() {
        if (currentIndex >= 0 && uploadedImages[currentIndex] && !isViewingOriginal) {
            try {
                const imageData = uploadedImages[currentIndex];
                const finalDataUrl = canvas.toDataURL('image/jpeg', 0.9);
                const description = descriptionInput.value.trim();

                imageData.drawingDataUrl = finalDataUrl;
                imageData.description = description;
                imageData.isEdited = true;

                updateGalleryThumbnail(currentIndex, finalDataUrl);
                updateGalleryDescription(currentIndex, description);

                console.log('✅ Auto-saved image', currentIndex);
            } catch (error) {
                console.error('Auto-save error:', error);
            }
        }
    }

    // Save to undo stack
    function saveToUndoStack() {
        if (isUndoRedoAction || isNavigating) return;

        try {
            const imageData = canvas.toDataURL('image/jpeg', 0.9);
            undoStack.push(imageData);
            if (undoStack.length > MAX_STACK_SIZE) {
                undoStack.shift();
            }
            redoStack = [];
        } catch (error) {
            console.error('Error saving to undo stack:', error);
        }
    }

    // Undo
    function undo() {
        if (undoStack.length <= 1) return;

        isUndoRedoAction = true;
        const currentState = undoStack.pop();
        redoStack.push(currentState);

        const previousState = undoStack[undoStack.length - 1];
        if (previousState) {
            const img = new Image();
            img.onload = function () {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                isUndoRedoAction = false;
                setTimeout(autoSaveCurrentImage, 100);
            };
            img.src = previousState;
        } else {
            isUndoRedoAction = false;
        }
    }

    // Redo
    function redo() {
        if (redoStack.length === 0) return;

        isUndoRedoAction = true;
        const nextState = redoStack.pop();
        undoStack.push(nextState);

        const img = new Image();
        img.onload = function () {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            isUndoRedoAction = false;
            setTimeout(autoSaveCurrentImage, 100);
        };
        img.src = nextState;
    }

    // Delete button
    const deleteBtn = document.getElementById('deleteImageBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function () {
            if (currentIndex >= 0 && uploadedImages[currentIndex]) {
                if (confirm(`Delete "${uploadedImages[currentIndex].name}"?`)) {
                    const indexToDelete = currentIndex;
                    modal.style.display = 'none';
                    uploadedImages.splice(indexToDelete, 1);
                    rebuildGallery();
                    showToast('Image deleted');
                }
            }
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
        const isModalOpen = modal.style.display === 'flex';
        if (!isModalOpen) return;

        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undo();
        } else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            redo();
        } else if (e.key === 'ArrowLeft' && prevBtn && !prevBtn.disabled) {
            e.preventDefault();
            navigateImage(-1);
        } else if (e.key === 'ArrowRight' && nextBtn && !nextBtn.disabled) {
            e.preventDefault();
            navigateImage(1);
        }
    });

    // Navigation
    function navigateImage(direction) {
        autoSaveCurrentImage();

        const newIndex = currentIndex + direction;
        if (newIndex < 0 || newIndex >= uploadedImages.length) return;

        isNavigating = true;
        currentIndex = newIndex;
        loadImageIntoEditor(currentIndex);
        updateNavigationButtons();
        isNavigating = false;
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', function () {
            if (!this.disabled) {
                navigateImage(-1);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', function () {
            if (!this.disabled) {
                navigateImage(1);
            }
        });
    }

    function updateNavigationButtons() {
        if (prevBtn) {
            prevBtn.disabled = currentIndex <= 0;
            prevBtn.style.opacity = currentIndex <= 0 ? '0.3' : '1';
            prevBtn.style.cursor = currentIndex <= 0 ? 'not-allowed' : 'pointer';
        }
        if (nextBtn) {
            nextBtn.disabled = currentIndex >= uploadedImages.length - 1;
            nextBtn.style.opacity = currentIndex >= uploadedImages.length - 1 ? '0.3' : '1';
            nextBtn.style.cursor = currentIndex >= uploadedImages.length - 1 ? 'not-allowed' : 'pointer';
        }
        if (imageCounter) {
            imageCounter.textContent = `${currentIndex + 1} / ${uploadedImages.length}`;
        }
    }

    function loadImageIntoEditor(index) {
        const imageData = uploadedImages[index];
        if (!imageData) return;

        originalImageData = imageData.localDataUrl;
        isViewingOriginal = false;

        if (toggleViewBtn) {
            toggleViewBtn.innerHTML = '<i class="fas fa-eye"></i> View Original';
            toggleViewBtn.style.background = '#2196F3';
        }

        undoStack = [];
        redoStack = [];

        if (imageData.drawingDataUrl && imageData.isEdited) {
            renderCompositeImage(originalImageData, imageData.drawingDataUrl);
        } else {
            const img = new Image();
            img.onload = function () {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                saveToUndoStack();
            };
            img.src = originalImageData;
        }

        descriptionInput.value = imageData.description || '';
    }

    function renderCompositeImage(originalData, drawingData) {
        const img = new Image();
        img.onload = function () {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            if (drawingData) {
                const drawingImg = new Image();
                drawingImg.onload = function () {
                    ctx.drawImage(drawingImg, 0, 0);
                    saveToUndoStack();
                };
                drawingImg.src = drawingData;
            } else {
                saveToUndoStack();
            }
        };
        img.src = originalData;
    }

    // Toggle view
    if (toggleViewBtn) {
        toggleViewBtn.addEventListener('click', function () {
            const imageData = uploadedImages[currentIndex];
            if (!imageData) return;

            autoSaveCurrentImage();

            isViewingOriginal = !isViewingOriginal;

            if (isViewingOriginal) {
                toggleViewBtn.innerHTML = '<i class="fas fa-undo"></i> View Edited';
                toggleViewBtn.style.background = '#ff9800';

                const img = new Image();
                img.onload = function () {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                };
                img.src = originalImageData;
            } else {
                toggleViewBtn.innerHTML = '<i class="fas fa-eye"></i> View Original';
                toggleViewBtn.style.background = '#2196F3';
                renderCompositeImage(originalImageData, imageData.drawingDataUrl);
            }
        });
    }

    // Drawing functions
    function startDrawing(e) {
        if (isViewingOriginal) {
            showToast('Switch to Edited view to draw');
            return;
        }

        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
            e.preventDefault();
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        lastX = (clientX - rect.left) * scaleX;
        lastY = (clientY - rect.top) * scaleY;

        saveToUndoStack();
    }

    function draw(e) {
        if (!isDrawing || isViewingOriginal) return;
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = document.getElementById('drawColor').value;
        ctx.lineWidth = parseInt(document.getElementById('drawSize').value);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        lastX = x;
        lastY = y;

        clearTimeout(window._drawSaveTimeout);
        window._drawSaveTimeout = setTimeout(autoSaveCurrentImage, 500);
    }

    function stopDrawing() {
        if (isDrawing && !isViewingOriginal) {
            isDrawing = false;
            autoSaveCurrentImage();
        }
        isDrawing = false;
    }

    // Canvas events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Touch support
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    // Clear drawings
    const clearDrawBtn = document.getElementById('clearDrawBtn');
    if (clearDrawBtn) {
        clearDrawBtn.addEventListener('click', function () {
            if (currentIndex >= 0 && uploadedImages[currentIndex]) {
                const imageData = uploadedImages[currentIndex];
                imageData.drawingDataUrl = null;
                imageData.isEdited = false;
                undoStack = [];
                redoStack = [];

                const img = new Image();
                img.onload = function () {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    updateGalleryThumbnail(currentIndex, originalImageData);
                    showToast('Drawings cleared');
                };
                img.src = originalImageData;
            }
        });
    }

    // Save button
    if (saveBtn) {
        saveBtn.addEventListener('click', function () {
            autoSaveCurrentImage();
            modal.style.display = 'none';
            showToast('✅ Image saved!');
        });
    }

    function updateGalleryThumbnail(index, dataUrl) {
        const galleryItems = document.querySelectorAll('.gallery-item');
        if (galleryItems[index]) {
            const img = galleryItems[index].querySelector('img');
            if (img) {
                img.src = dataUrl;
            }
        }
    }

    function updateGalleryDescription(index, description) {
        const galleryItems = document.querySelectorAll('.gallery-item');
        if (galleryItems[index]) {
            const descDiv = galleryItems[index].querySelector('.gallery-item-desc');
            if (descDiv) {
                descDiv.textContent = description;
                descDiv.style.display = description ? 'block' : 'none';
                if (description) {
                    descDiv.classList.add('visible');
                } else {
                    descDiv.classList.remove('visible');
                }
            }
        }
    }

    // Open editor
    window.openImageEditor = function (index) {
        if (currentIndex >= 0) {
            autoSaveCurrentImage();
        }

        currentIndex = index;
        loadImageIntoEditor(index);
        updateNavigationButtons();
        modal.style.display = 'flex';
    };
}

// ============================================
// IMAGE UPLOAD
// ============================================

function setupImageUpload() {
    const fileInput = document.getElementById('issueImages');
    const dropZone = document.getElementById('imageDropZone');
    const gallery = document.getElementById('imageGallery');
    const statusText = document.getElementById('uploadStatus');

    if (!fileInput) return;

    fileInput.addEventListener('change', function (e) {
        const files = Array.from(this.files);
        if (files.length === 0) return;

        const validFiles = files.filter(file => {
            if (!file.type.startsWith('image/')) {
                showErrorMessage(`"${file.name}" is not an image file.`);
                return false;
            }
            if (file.size > 5 * 1024 * 1024) {
                showErrorMessage(`"${file.name}" exceeds 5MB limit.`);
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) {
            this.value = '';
            return;
        }

        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const imageInfo = {
                    name: file.name,
                    size: file.size,
                    localDataUrl: e.target.result,
                    description: '',
                    drawingDataUrl: null,
                    isEdited: false,
                    isUploaded: false,
                    file: file
                };
                uploadedImages.push(imageInfo);
                addImageToGallery(imageInfo, uploadedImages.length - 1);

                if (statusText) {
                    statusText.textContent = `${uploadedImages.length} image(s) loaded`;
                    statusText.style.color = '#4CAF50';
                }
            };
            reader.readAsDataURL(file);
        });

        this.value = '';
    });

    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');

            const files = Array.from(e.dataTransfer.files);
            const validFiles = files.filter(file => {
                if (!file.type.startsWith('image/')) {
                    showErrorMessage(`"${file.name}" is not an image file.`);
                    return false;
                }
                if (file.size > 5 * 1024 * 1024) {
                    showErrorMessage(`"${file.name}" exceeds 5MB limit.`);
                    return false;
                }
                return true;
            });

            if (validFiles.length > 0) {
                validFiles.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const imageInfo = {
                            name: file.name,
                            size: file.size,
                            localDataUrl: e.target.result,
                            description: '',
                            drawingDataUrl: null,
                            isEdited: false,
                            isUploaded: false,
                            file: file
                        };
                        uploadedImages.push(imageInfo);
                        addImageToGallery(imageInfo, uploadedImages.length - 1);

                        if (statusText) {
                            statusText.textContent = `${uploadedImages.length} image(s) loaded`;
                            statusText.style.color = '#4CAF50';
                        }
                    };
                    reader.readAsDataURL(file);
                });
            }
        });
    }
}

function addImageToGallery(imageInfo, index) {
    const gallery = document.getElementById('imageGallery');

    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.id = 'img_' + Date.now();

    const imgSrc = imageInfo.drawingDataUrl || imageInfo.localDataUrl || imageInfo.url || '';

    item.innerHTML = `
        <img src="${imgSrc}" alt="${imageInfo.name}" loading="lazy" onclick="window.openImageEditor(${index})">
        <div class="gallery-item-name">${imageInfo.name}</div>
        ${imageInfo.description ? `<div class="gallery-item-desc visible">${imageInfo.description}</div>` : '<div class="gallery-item-desc"></div>'}
    `;

    gallery.appendChild(item);
    gallery.style.display = 'flex';
}

window.removeImage = function (index) {
    if (!confirm('Remove this image?')) return;
    uploadedImages.splice(index, 1);
    rebuildGallery();
};

function rebuildGallery() {
    const gallery = document.getElementById('imageGallery');
    gallery.innerHTML = '';

    if (uploadedImages.length === 0) {
        gallery.style.display = 'none';
        const statusText = document.getElementById('uploadStatus');
        if (statusText) {
            statusText.textContent = 'No images loaded';
            statusText.style.color = '#888';
        }
        return;
    }

    uploadedImages.forEach((img, idx) => {
        addImageToGallery(img, idx);
    });

    const statusText = document.getElementById('uploadStatus');
    if (statusText) {
        statusText.textContent = `${uploadedImages.length} image(s) loaded`;
        statusText.style.color = '#4CAF50';
    }
}

// ============================================
// HANDLE BOOKING - COMPLETE FIXED VERSION
// ============================================

async function handleBooking(e) {
    // ✅ Clear old order references before creating a new one
    localStorage.removeItem('buildbuddy_last_service_order');
    sessionStorage.removeItem('buildbuddy_pending_service_order');
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        // Get form values
        const customerName = document.getElementById('customerName').value.trim();
        let contactPhone = document.getElementById('contactPhone').value.trim();
        contactPhone = contactPhone.replace(/[\s\-\(\)\.]/g, '');
        if (contactPhone.length > 20) {
            console.warn('⚠️ Phone number too long (' + contactPhone.length + ' chars), truncating to 20');
            contactPhone = contactPhone.substring(0, 20);
        }
        const deviceModel = document.getElementById('deviceModel').value.trim();
        const deviceIssue = document.getElementById('deviceIssue').value.trim();
        const address = document.getElementById('address').value.trim();
        const preferredDate = document.getElementById('preferredDate').value;
        const preferredTime = document.getElementById('preferredTime').value;
        const notes = document.getElementById('notes').value.trim();

        // Validate required fields
        if (!customerName || !contactPhone || !deviceModel || !address) {
            throw new Error('Please fill in all required fields.');
        }

        // Get user info
        let userId = null;
        let sessionId = null;

        try {
            const userData = localStorage.getItem('buildbuddy_user') || sessionStorage.getItem('buildbuddy_user');
            if (userData) {
                const user = JSON.parse(userData);
                userId = user.user_id || user.id || null;
                console.log('👤 User ID:', userId);
            }
        } catch (e) {
            console.warn('Could not get user data:', e);
        }

        // Get or create session
        if (!userId) {
            sessionId = localStorage.getItem('buildbuddy_session_id');
            if (!sessionId) {
                sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('buildbuddy_session_id', sessionId);
            }
            console.log('🔑 Session ID:', sessionId);
        }

        // Add notes with image info
        let finalNotes = notes || '';
        if (uploadedImages.length > 0) {
            finalNotes += '\n\n📷 Uploaded Images:\n';
            uploadedImages.forEach((img, index) => {
                const desc = img.description ? ` (${img.description})` : '';
                finalNotes += `  ${index + 1}. ${img.url || 'image' + (index + 1)}${desc}\n`;
            });
        }

        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('buildbuddy_session_id', sessionId);
        }
        console.log('🔑 Session ID:', sessionId);

        // Build order data
        const orderData = {
            user_id: userId,
            session_id: sessionId,
            service_id: parseInt(serviceId),
            device_model: deviceModel,
            device_issue: deviceIssue || null,
            address: address,
            contact_phone: contactPhone,
            preferred_date: preferredDate || null,
            preferred_time: preferredTime || null,
            notes: finalNotes || null,
            order_status: 'PENDING',
            assigned_staff_id: null
        };

        console.log('📝 Creating order with data:', orderData);

        // Insert the order
        const { error: insertError } = await supabase
            .from('service_orders')
            .insert([orderData]);

        console.log('📦 Insert result:', { error: insertError });

        if (insertError) {
            console.error('❌ Insert error:', insertError);
            throw new Error('Failed to create service booking: ' + insertError.message);
        }

        // ✅ Fetch the order using multiple fields to uniquely identify it
        // Since session_id is null, use device_model, service_id, and contact_phone
        const { data: fetchedData, error: fetchError } = await supabase
            .from('service_orders')
            .select('*')
            .eq('service_id', parseInt(serviceId))
            .eq('device_model', deviceModel)
            .eq('contact_phone', contactPhone)
            .eq('order_status', 'PENDING')
            .order('order_id', { ascending: false })
            .limit(1);

        console.log('📦 Fetch result:', { data: fetchedData, error: fetchError });

        if (fetchError) {
            console.error('❌ Fetch error:', fetchError);
            throw new Error('Failed to retrieve created order: ' + fetchError.message);
        }

        if (!fetchedData || fetchedData.length === 0) {
            console.error('❌ No order found after insert');
            throw new Error('Failed to retrieve created order');
        }

        const orderResult = fetchedData[0];
        console.log('✅ Order created successfully:', orderResult);

        // ============================================
        // UPLOAD IMAGES
        // ============================================
        const uploadedImageRecords = [];

        for (const img of uploadedImages) {
            try {
                let finalUrl = '';
                let imagePath = '';

                const imageToUpload = img.drawingDataUrl || img.localDataUrl;

                if (imageToUpload) {
                    const response = await fetch(imageToUpload);
                    const blob = await response.blob();

                    const timestamp = Date.now();
                    const random = Math.random().toString(36).substring(2, 8);
                    const extension = img.name.split('.').pop();
                    const filename = `customer/${timestamp}_${random}.${extension}`;

                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('images')
                        .upload(filename, blob, {
                            cacheControl: '3600',
                            upsert: true
                        });

                    if (uploadError) {
                        console.error('❌ Upload error for', img.name, uploadError);
                        continue;
                    }

                    finalUrl = `${SUPABASE_URL}/storage/v1/object/public/images/${filename}`;
                    imagePath = filename;
                    img.isUploaded = true;
                    console.log('✅ Image uploaded:', filename);
                }

                if (finalUrl) {
                    uploadedImageRecords.push({
                        order_id: orderResult.order_id,
                        image_url: finalUrl,
                        image_path: imagePath,
                        description: img.description || ''
                    });
                }

            } catch (uploadError) {
                console.error('❌ Failed to upload image:', img.name, uploadError);
            }
        }

        // Save image records to database
        if (uploadedImageRecords.length > 0) {
            console.log('📸 Saving image records:', uploadedImageRecords);
            const { error: imageError } = await supabase
                .from('service_order_images')
                .insert(uploadedImageRecords);

            if (imageError) {
                console.error('❌ Failed to save image records:', imageError);
            } else {
                console.log('✅ Image records saved successfully');
            }
        }

        // ============================================
        // ADD SERVICE TO CART
        // ============================================
        if (serviceData) {
            try {
                await dataService.ensureInitialized();
                await dataService.addServiceToCart(parseInt(serviceId));

                const serviceOrder = {
                    order_id: orderResult.order_id,
                    service_id: parseInt(serviceId)
                };
                localStorage.setItem('buildbuddy_last_service_order', JSON.stringify(serviceOrder));
                console.log('✅ Service added to cart:', serviceOrder);

            } catch (cartError) {
                console.error('❌ Failed to add service to cart:', cartError);
                showToast('⚠️ Service booked but failed to add to cart. Please check cart manually.');
            }
        }

        // ============================================
        // STORE PENDING ORDER FOR PAYMENT
        // ============================================
        if (orderResult) {
            const serviceOrderRef = {
                order_id: orderResult.order_id,
                service_id: parseInt(serviceId),
                device_model: deviceModel,
                preferred_date: preferredDate,
                preferred_time: preferredTime
            };

            // Store in both localStorage and sessionStorage
            localStorage.setItem('buildbuddy_pending_service_order', JSON.stringify(serviceOrderRef));
            sessionStorage.setItem('buildbuddy_pending_service_order', JSON.stringify(serviceOrderRef));
            localStorage.setItem('buildbuddy_last_service_order', JSON.stringify(serviceOrderRef));

            console.log('✅ Stored pending order:', serviceOrderRef);
            console.log('✅ sessionStorage has:', sessionStorage.getItem('buildbuddy_pending_service_order'));
        }

        // ============================================
        // SHOW SUCCESS
        // ============================================
        showSuccessAndRedirect(orderResult);

    } catch (error) {
        console.error('❌ Booking error:', error);
        showErrorMessage(error.message || 'Failed to book service. Please try again.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Confirm Booking';
    }
}

function showSuccessAndRedirect(order) {
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Booking Confirmed!';
    submitBtn.style.background = '#4CAF50';
    submitBtn.style.color = 'white';

    const form = document.getElementById('bookingForm');
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        text-align: center;
        padding: 30px 20px;
        background: #e8f5e9;
        border-radius: 12px;
        margin-top: 20px;
    `;

    const uploadedCount = uploadedImages.filter(img => img.isUploaded).length;
    let imagesHtml = '';
    if (uploadedImages.length > 0) {
        imagesHtml = `
            <div style="margin: 15px 0;">
                <p style="color: #4CAF50; font-weight: 600;">📷 ${uploadedCount}/${uploadedImages.length} image(s) uploaded</p>
            </div>
        `;
    }

    successDiv.innerHTML = `
        <i class="fas fa-check-circle" style="font-size: 48px; color: #4CAF50; margin-bottom: 15px;"></i>
        <h3 style="color: #2e7d32; margin-bottom: 10px;">Service Booked Successfully!</h3>
        <p style="color: #555; margin-bottom: 5px;">Your service has been added to the cart.</p>
        <p style="color: #777; font-size: 14px;">Order #${order.order_id}</p>
        ${imagesHtml}
        <div style="margin-top: 20px; display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
            <button onclick="window.location.href='cart.html'" class="btn-primary" style="padding: 12px 30px; border: none; border-radius: 8px; background: #00d4ff; color: #1a1a2e; font-weight: 600; cursor: pointer;">
                View Cart <i class="fas fa-arrow-right"></i>
            </button>
            <button onclick="window.location.href='service.html'" class="btn-outline" style="padding: 12px 30px; border: 2px solid #00d4ff; border-radius: 8px; background: transparent; color: #1a1a2e; font-weight: 600; cursor: pointer;">
                <i class="fas fa-arrow-left"></i> More Services
            </button>
        </div>
    `;
    form.appendChild(successDiv);

    submitBtn.style.display = 'none';
    document.querySelectorAll('.form-group').forEach(el => el.style.opacity = '0.5');
    document.querySelectorAll('.form-group input, .form-group textarea, .form-group select').forEach(el => el.disabled = true);

    setTimeout(() => {
        window.location.href = 'cart.html';
    }, 5000);
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: #333;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 99999;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showErrorMessage(message) {
    const form = document.getElementById('bookingForm');
    const existingError = form.querySelector('.booking-error');
    if (existingError) existingError.remove();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'booking-error';
    errorDiv.style.cssText = `
        background: #ffebee;
        color: #c62828;
        padding: 15px 20px;
        border-radius: 8px;
        margin-bottom: 20px;
        border-left: 4px solid #c62828;
    `;
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span style="margin-left: 10px;">${message}</span>
    `;
    form.prepend(errorDiv);
}

function showError(message) {
    const container = document.querySelector('.booking-container');
    if (!container) return;

    container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
            <h2 style="color: #1a1a2e; margin-bottom: 10px;">Something Went Wrong</h2>
            <p style="color: #666; margin-bottom: 30px;">${message}</p>
            <a href="service.html" class="btn-primary" style="padding: 12px 30px; border-radius: 8px; background: #00d4ff; color: #1a1a2e; text-decoration: none; font-weight: 600;">
                <i class="fas fa-arrow-left"></i> Back to Services
            </a>
        </div>
    `;
}