const dropArea = document.getElementById('dropArea');
const input = document.getElementById('imageInput');
const container = document.getElementById('cardsContainer');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const processingStatus = document.getElementById('processingStatus');

const menuButton = document.getElementById('mobile-menu-button');
const mobileMenu = document.getElementById('mobile-menu');
const downloadCropBtn = document.getElementById('downloadCropBtn');


const loadingCropZip = document.getElementById('loadingCropZip');

downloadCropBtn.addEventListener('click', async () => {
    loadingCropZip.classList.remove('hidden');
    downloadCropBtn.disabled = true; // disable tombol biar gak double click

    const newZip = new JSZip();

    // Loop semua file di zipFilesMap, proses auto crop lalu masukkan ke zip baru
    for (let [filename, blob] of zipFilesMap.entries()) {
        const croppedBlob = await autoCropImage(blob);
        newZip.file(filename, croppedBlob);
    }

    // generate zip file setelah semua selesai auto crop
    const content = await newZip.generateAsync({ type: 'blob' });

    // buat link download dan klik otomatis
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'processed_images_auto_crop.zip';
    link.click();

    loadingCropZip.classList.add('hidden');
    downloadCropBtn.disabled = false;
});

async function autoCropImage(blob) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Gambar image ke canvas
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // Ambil data pixel
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            let minX = canvas.width, minY = canvas.height;
            let maxX = 0, maxY = 0;

            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const idx = (y * canvas.width + x) * 4;
                    const alpha = data[idx + 3];

                    if (alpha > 0) {
                        if (x < minX) minX = x;
                        if (y < minY) minY = y;
                        if (x > maxX) maxX = x;
                        if (y > maxY) maxY = y;
                    }
                }
            }

            const cropWidth = maxX - minX + 1;
            const cropHeight = maxY - minY + 1;

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropWidth;
            cropCanvas.height = cropHeight;
            const cropCtx = cropCanvas.getContext('2d');

            cropCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

            cropCanvas.toBlob((croppedBlob) => {
                resolve(croppedBlob);
            }, 'image/png');
        };

        img.src = URL.createObjectURL(blob);
    });
}




menuButton.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
});

let cropper;

function startCropper() {
    const previewImg = document.getElementById('image-preview');

    if (cropper) {
        cropper.destroy();
    }

    cropper = new Cropper(previewImg, {
        aspectRatio: NaN,
        viewMode: 1,
    });
}

function applyCrop() {
    if (!cropper) return;

    const canvas = cropper.getCroppedCanvas();
    const croppedDataUrl = canvas.toDataURL();

    // Update the preview
    document.getElementById('image-preview').src = croppedDataUrl;

    // Destroy cropper instance
    cropper.destroy();
    cropper = null;

    // Optionally update original image input (bg-image) if needed
}

let totalFiles = 0;
let processedFiles = 0;
let zip = new JSZip();
const zipFilesMap = new Map();

let selectedImageUrl = '';

function openEditorModal(imageUrl) {
    selectedImageUrl = imageUrl;
    document.getElementById('editor-modal').style.display = 'block';
    document.getElementById('image-preview').src = imageUrl;
}

function closeEditorModal() {
    document.getElementById('editor-modal').style.display = 'none';
}

function changeBackgroundColor() {
    const color = document.getElementById('bg-color').value;
    document.getElementById('image-preview').style.backgroundColor = color;
}

function changeBackgroundImage() {
    const file = document.getElementById('bg-image').files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('image-preview').style.backgroundImage = `url(${e.target.result})`;
        }
        reader.readAsDataURL(file);
    }
}
function setPresetColor(color) {
    document.getElementById('bg-color').value = color;
    changeBackgroundColor();
}

document.getElementById('image-preview').onload = function () {
    const image = this;
    document.getElementById('resize-width').value = image.naturalWidth;
    document.getElementById('resize-height').value = image.naturalHeight;
    updatePreviewSize();
};


document.getElementById('resize-width').addEventListener('input', function () {
    const lock = document.getElementById('lock-aspect').checked;
    const image = document.getElementById('image-preview');
    if (!lock) return updatePreviewSize();
    const ratio = image.naturalHeight / image.naturalWidth;
    document.getElementById('resize-height').value = Math.round(this.value * ratio);
    updatePreviewSize();
});

document.getElementById('resize-height').addEventListener('input', function () {
    const lock = document.getElementById('lock-aspect').checked;
    const image = document.getElementById('image-preview');
    if (!lock) return updatePreviewSize();
    const ratio = image.naturalWidth / image.naturalHeight;
    document.getElementById('resize-width').value = Math.round(this.value * ratio);
    updatePreviewSize();
});

function downloadEditedImage() {
    const image = document.getElementById('image-preview');
    const bgImageInput = document.getElementById('bg-image');
    const bgColor = document.getElementById('bg-color').value;

    // Ambil nilai resize (fallback ke ukuran asli jika kosong)
    const width = parseInt(document.getElementById('resize-width').value) || image.naturalWidth;
    const height = parseInt(document.getElementById('resize-height').value) || image.naturalHeight;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;

    const drawAndDownload = (bgDrawFn) => {
        bgDrawFn(); // gambar background
        ctx.drawImage(image, 0, 0, width, height); // gambar utama
        canvas.toBlob(function (blob) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'edited_image.png';
            link.click();
        }, 'image/png');
    };

    if (bgImageInput.files && bgImageInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const bgImg = new Image();
            bgImg.onload = function () {
                drawAndDownload(() => {
                    ctx.drawImage(bgImg, 0, 0, width, height);
                });
            };
            bgImg.src = e.target.result;
        };
        reader.readAsDataURL(bgImageInput.files[0]);
    } else {
        drawAndDownload(() => {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, width, height);
        });
    }
}
function updatePreviewSize() {
    const img = document.getElementById('image-preview');
    const width = parseInt(document.getElementById('resize-width').value);
    const height = parseInt(document.getElementById('resize-height').value);

    if (width && height) {
        img.style.width = `${width}px`;
        img.style.height = `${height}px`;
    } else {
        img.style.width = 'auto';
        img.style.height = 'auto';
    }
}


function saveChanges() {
    const newBackground = document.getElementById('image-preview').style.backgroundImage || document.getElementById('image-preview').style.backgroundColor;
    const previewImage = document.getElementById('image-preview');
    previewImage.style.backgroundImage = newBackground;
    closeEditorModal();
}// Untuk melacak file yang tersimpan di ZIP

dropArea.addEventListener('click', () => input.click());
dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('bg-primary-100');
    dropArea.classList.add('border-primary-500');
});
dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('bg-primary-100');
    dropArea.classList.remove('border-primary-500');
});
dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('bg-primary-100');
    dropArea.classList.remove('border-primary-500');
    handleFiles(e.dataTransfer.files);
});
input.addEventListener('change', () => {
    handleFiles(input.files);
});

async function handleFiles(files) {
    if (files.length === 0) return;

    totalFiles = files.length;
    processedFiles = 0;
    zip = new JSZip();
    zipFilesMap.clear();
    container.innerHTML = ''; // Hapus semua card sebelumnya
    processingStatus.classList.remove('hidden');
    downloadAllBtn.classList.add('hidden');

    for (const file of files) {
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg shadow-md flex flex-col items-center card-hover';
        card.innerHTML = `
          <p class="text-sm font-medium text-gray-700 mb-2 truncate w-full text-center hover:text-primary-600 transition-colors duration-200" title="${file.name}">${file.name}</p>
          <div class="relative w-full pt-[100%] mb-3 overflow-hidden rounded-lg bg-gradient-to-br from-gray-50 to-white shadow-inner">
            <!-- Animated background elements -->
            <div class="absolute inset-0 bg-gradient-to-r from-primary-50/50 to-primary-100/50 animate-pulse"></div>
            <div class="absolute -bottom-6 -right-6 w-24 h-24 bg-primary-200/30 rounded-full animate-pulse"></div>
            <div class="absolute -top-6 -left-6 w-20 h-20 bg-secondary-200/20 rounded-full animate-pulse"></div>
            
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <!-- Improved spinner with 3D effect -->
              <div class="relative z-10 transform hover:scale-105 transition-all duration-300">
                <!-- Outer glow -->
                <div class="absolute -inset-2 bg-primary-300/20 rounded-full blur-xl opacity-70 animate-pulse"></div>
                <!-- Inner glow -->
                <div class="absolute -inset-1 bg-primary-400/30 rounded-full blur-md opacity-80 animate-pulse"></div>
                <!-- Spinner -->
                <div class="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin relative z-10 shadow-lg">
                  <!-- Inner spinner accent -->
                  <div class="absolute inset-1 rounded-full border border-primary-200 border-t-transparent animate-spin opacity-50"></div>
                </div>
              </div>
              
              <!-- Processing text with animation -->
              <div class="mt-5 relative z-10 bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-md transform hover:scale-105 transition-all duration-300">
                <p class="text-xs font-medium bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-500 animate-pulse">Sedang memproses...</p>
              </div>
            </div>
          </div>
          
          <!-- Improved progress indicator -->
          <div class="flex items-center justify-between w-full bg-gray-50 p-2 rounded-lg shadow-sm">
            <div class="flex-1 mr-3">
              <div class="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 w-3/4 rounded-full animate-pulse shadow-inner"></div>
              </div>
              <div class="flex justify-between mt-1 text-[10px] text-gray-400">
                <span>0%</span>
                <span>Menghapus background...</span>
                <span>100%</span>
              </div>
            </div>
            <div class="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded-md shadow-inner animate-pulse">75%</div>
          </div>
        `;
        container.appendChild(card);

        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch('/process-single', {
                method: 'POST',
                body: formData
            });

            const blob = await res.blob();
            const filename = `processed_${Date.now()}_${Math.floor(Math.random() * 10000)}.png`;
            zip.file(filename, blob);
            zipFilesMap.set(filename, blob);

            const url = URL.createObjectURL(blob);
            card.setAttribute('data-filename', filename);
            card.innerHTML = `
            <div class="relative w-full pt-[100%] mb-3 overflow-hidden rounded-lg shadow-lg group">
              <div class="absolute inset-0 bg-gradient-to-br from-gray-200 to-white opacity-50"></div>
              <img src="${url}" alt="Processed" class="absolute inset-0 w-full h-full object-cover z-10 transition-transform duration-300 group-hover:scale-105">
              <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <p class="text-white text-sm truncate">${filename}</p>
              </div>
            </div>
            <div class="flex space-x-2 w-full">
              <div class="relative group w-full">

                <button class="flex-1 px-3 py-2.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-[1.02] flex items-center justify-center group relative overflow-hidden w-full" onclick="toggleDropdown(this)">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span class="relative z-10">Download</span>
                </button>
              <div class="hidden absolute z-30 mt-2 w-full bg-white border border-gray-200 rounded-md shadow-lg" data-dropdown>
                <a href="${url}" download="${filename}" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Download HD (PNG)</a>
                <button onclick="downloadCompressed(this, 'image/png', 'png')" data-url="${url}" class="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Download Compressed (PNG)</button>
                <button onclick="downloadCompressed(this, 'image/jpeg', 'jpg')" data-url="${url}" class="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Download Compressed (JPG)</button>
                <button onclick="downloadCompressed(this, 'image/webp', 'webp')" data-url="${url}" class="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Download Compressed (WEBP)</button>
                <button onclick="downloadAutoCrop(this, '${filename}')" data-url="${url}" class="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Download Auto Crop (PNG)</button>
              </div>

              </div>

              <button 
                class="p-2.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-[1.02] flex items-center justify-center group relative overflow-hidden" 
                onclick="confirmDelete(this)">
                <!-- Efek lingkaran pada hover -->
                <span class="absolute w-0 h-0 rounded-full bg-white opacity-10 group-hover:w-20 group-hover:h-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"></span>
                <!-- Ikon hapus yang lebih detail -->
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
              <button 
                class="p-2.5 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-[1.02] flex items-center justify-center group relative overflow-hidden" 
                onclick="openEditorModal('${url}')">
                <!-- Efek lingkaran pada hover -->
                <span class="absolute w-0 h-0 rounded-full bg-white opacity-10 group-hover:w-20 group-hover:h-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"></span>
                <!-- Ikon edit yang lebih detail -->
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            <button 
class="p-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-[1.02] flex items-center justify-center group relative overflow-hidden" 
onclick="openBrushEditorModal('${url}', '${filename}')">
<span class="absolute w-0 h-0 rounded-full bg-white opacity-10 group-hover:w-20 group-hover:h-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"></span>
<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 20l9-5-9-5-9 5 9 5z" />
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 12V4" />
</svg>
</button>

            </div>
          `;
        } catch (err) {
            card.innerHTML = `
            <div class="p-4 bg-red-50 rounded-lg text-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-red-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-red-600 text-sm">Gagal memproses ${file.name}</p>
            </div>
          `;
        }

        processedFiles++;
        if (processedFiles === totalFiles) {
            processingStatus.classList.add('hidden');
            downloadAllBtn.classList.remove('hidden');

            downloadCropBtn.classList.remove('hidden');
        }
    }

    input.value = '';
}

function confirmDelete(button) {
    Swal.fire({
        title: 'Yakin ingin menghapus gambar ini?',
        text: 'Tindakan ini tidak dapat dibatalkan!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, hapus',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            deleteImage(button);
        }
    });
}

function deleteImage(button) {
    const card = button.closest('div.card-hover');
    const filename = card.getAttribute('data-filename');
    if (filename) {
        zip.remove(filename);
        zipFilesMap.delete(filename);
    }
    card.remove();

    if (container.childElementCount === 0) {
        downloadAllBtn.classList.add('hidden');
    }
}

downloadAllBtn.addEventListener('click', () => {
    const newZip = new JSZip();
    for (let [filename, blob] of zipFilesMap.entries()) {
        newZip.file(filename, blob);
    }
    newZip.generateAsync({ type: 'blob' }).then(function (content) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'processed_images.zip';
        link.click();
    });
});

function downloadCompressed(button, mimeType = "image/png", ext = "png") {
    const imageUrl = button.dataset.url;

    fetch(imageUrl)
        .then(res => res.blob())
        .then(blob => {
            const img = new Image();
            img.onload = function () {
                // Resize ke lebar maksimal 1024px
                const MAX_WIDTH = 1024;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    const scale = MAX_WIDTH / width;
                    width = MAX_WIDTH;
                    height = Math.round(height * scale);
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((compressedBlob) => {
                    const url = URL.createObjectURL(compressedBlob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `compressed_image.${ext}`;
                    a.click();
                    URL.revokeObjectURL(url);
                }, mimeType, mimeType === 'image/jpeg' ? 0.5 : 0.6); // kualitas bisa diatur
            };
            img.src = URL.createObjectURL(blob);
        });

    // Tutup dropdown
    document.querySelectorAll('[data-dropdown]').forEach(el => el.classList.add('hidden'));
}



function toggleDropdown(button) {
    const dropdown = button.nextElementSibling;
    document.querySelectorAll('[data-dropdown]').forEach(el => {
        if (el !== dropdown) el.classList.add('hidden');
    });
    dropdown.classList.toggle('hidden');
}

async function downloadAutoCrop(btn, filenameOriginal) {
    const parentCard = btn.closest('.card-hover');
    const imgTag = parentCard.querySelector('img');
    const imgUrl = imgTag.src;

    // Fetch ulang blob dari image processed untuk dikirim ke /remove-bg-crop
    const blob = await fetch(imgUrl).then(res => res.blob());
    const formData = new FormData();
    formData.append('image', blob, filenameOriginal);

    try {
        const cropRes = await fetch('/remove-bg-crop', {
            method: 'POST',
            body: formData
        });

        const cropBlob = await cropRes.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(cropBlob);
        link.download = `autocrop_${filenameOriginal.replace(/\.[^/.]+$/, "")}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        alert('Gagal generate Auto Crop PNG');
        console.error(err);
    }
}