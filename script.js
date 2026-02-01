document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const editorPanel = document.getElementById('editorPanel');
    const resultsGrid = document.getElementById('resultsGrid');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValue = document.getElementById('qualityValue');
    const addMoreBtn = document.getElementById('addMoreBtn');
    const addMoreInput = document.getElementById('addMoreInput');
    const clearAllBtn = document.getElementById('clearAllBtn');

    const maxWidthSelect = document.getElementById('maxWidthSelect');

    // State
    let processedImages = []; // Array of { id, originalFile, originalImage, quality, blob }

    // --- Event Listeners ---

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });

    // Main Upload Input
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
            // Clear input so same files can be selected again if needed
            fileInput.value = '';
        }
    });

    // Add More Input
    addMoreBtn.addEventListener('click', () => addMoreInput.click());
    addMoreInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
            addMoreInput.value = '';
        }
    });

    // Clear All
    clearAllBtn.addEventListener('click', () => {
        processedImages = [];
        resultsGrid.innerHTML = '';
        editorPanel.classList.add('hidden');
        dropZone.classList.remove('hidden');
    });

    // Max Width Select
    maxWidthSelect.addEventListener('change', () => {
        reprocessAllImages();
    });

    // Quality Slider (Debounced for performance)
    let timeout;
    qualitySlider.addEventListener('input', (e) => {
        qualityValue.textContent = `${e.target.value}%`;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            reprocessAllImages();
        }, 100);
    });

    // --- Functions ---

    function handleFiles(fileList) {
        // Show editor, hide dropzone if it's the first batch
        if (processedImages.length === 0) {
            dropZone.classList.add('hidden');
            editorPanel.classList.remove('hidden');
        }

        Array.from(fileList).forEach(file => {
            if (!file.type.match('image.*')) return;

            const id = Date.now() + Math.random().toString(36).substr(2, 9);
            const imageEntry = {
                id,
                file,
                element: createCardElement(id, file),
                originalImage: null
            };

            processedImages.push(imageEntry);
            resultsGrid.appendChild(imageEntry.element);

            // Read and Process
            loadImage(imageEntry);
        });
    }

    function createCardElement(id, file) {
        const div = document.createElement('div');
        div.className = 'result-card';
        div.id = `card-${id}`;
        div.innerHTML = `
            <div class="card-preview">
                <div class="loading-overlay" id="loading-${id}">
                    <div class="spinner"></div>
                </div>
                <img id="img-${id}" alt="${file.name}">
            </div>
            <div class="card-info">
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="size-comparison">
                    <span class="old-size">${formatSize(file.size)}</span>
                    <span class="arrow">→</span>
                    <span class="new-size" id="size-${id}">...</span>
                </div>
                <div class="savings-tag" id="savings-${id}">Computing...</div>
                <div class="card-actions">
                    <a id="dl-${id}" class="btn btn-primary btn-sm btn-download" style="opacity: 0.5; pointer-events: none;">
                        <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        Download
                    </a>
                </div>
            </div>
        `;
        return div;
    }

    function loadImage(entry) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                entry.originalImage = img;
                // Set preview to original first, will be updated if needed or just kept
                const imgEl = document.getElementById(`img-${entry.id}`);
                imgEl.src = img.src;

                // Process
                processSingleImage(entry);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(entry.file);
    }

    function processSingleImage(entry) {
        if (!entry.originalImage) return;

        const quality = parseInt(qualitySlider.value) / 100;
        const maxWidth = parseInt(maxWidthSelect.value);

        // Show loading
        const loading = document.getElementById(`loading-${entry.id}`);
        loading.style.display = 'flex';

        // Use requestAnimationFrame to prevent UI freezing
        requestAnimationFrame(() => {
            const canvas = document.createElement('canvas');

            // Calculate Dimensions
            let width = entry.originalImage.width;
            let height = entry.originalImage.height;

            if (maxWidth > 0 && width > maxWidth) {
                const ratio = maxWidth / width;
                width = maxWidth;
                height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(entry.originalImage, 0, 0, width, height);

            canvas.toBlob((blob) => {
                entry.blob = blob;
                updateCardStats(entry);
                loading.style.display = 'none';
            }, 'image/webp', quality);
        });
    }

    function reprocessAllImages() {
        processedImages.forEach(entry => {
            processSingleImage(entry);
        });
    }

    function updateCardStats(entry) {
        const sizeEl = document.getElementById(`size-${entry.id}`);
        const savingsEl = document.getElementById(`savings-${entry.id}`);
        const dlBtn = document.getElementById(`dl-${entry.id}`);

        sizeEl.textContent = formatSize(entry.blob.size);

        // Calculate Savings
        const original = entry.file.size;
        const optimized = entry.blob.size;
        const diff = original - optimized;
        const percent = Math.round((diff / original) * 100);

        if (percent > 0) {
            savingsEl.textContent = `Saved ${percent}%`;
            savingsEl.style.color = 'var(--success-color)';
        } else {
            savingsEl.textContent = `+${Math.abs(percent)}% (Larger)`;
            savingsEl.style.color = 'var(--danger-color)';
        }

        // Setup Download
        const url = URL.createObjectURL(entry.blob);
        dlBtn.href = url;
        const originalName = entry.file.name.substring(0, entry.file.name.lastIndexOf('.')) || entry.file.name;
        dlBtn.download = `${originalName}.webp`;
        dlBtn.style.opacity = '1';
        dlBtn.style.pointerEvents = 'auto';

        // Clean up old object URL if exists (not strictly tracked here for simplicity but good practice)
    }

    function formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});
