const fileInput = document.getElementById('fileInput');
const previewImage = document.getElementById('previewImage');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const result = document.getElementById('result');
const resultImage = document.getElementById('resultImage');
const caption = document.getElementById('caption');
const error = document.getElementById('error');

let selectedFile = null;

fileInput.addEventListener('change', function(event) {
    const file = event.target.files[0];

    if (file) {
        selectedFile = file;

        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            previewImage.style.display = 'block';
        };
        reader.readAsDataURL(file);

        analyzeBtn.disabled = false;
        result.style.display = 'none';
        error.style.display = 'none';
    }
});

analyzeBtn.addEventListener('click', async function() {
    if (!selectedFile) {
        showError('Пожалуйста, выберите изображение');
        return;
    }

    loading.style.display = 'block';
    result.style.display = 'none';
    error.style.display = 'none';
    analyzeBtn.disabled = true;

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
        const response = await fetch('http://localhost:8000/upload', {
            method: 'POST',
            body: formData
        });

        console.log('hmmm');

        if (!response.ok) {
            throw new Error('Ошибка сервера');
        }
        console.log('hmm');

        const data = await response.json();

        showResult(data.caption, data.image);

    } catch (err) {
        showError('Ошибка при анализе изображения: ' + err.message);
    } finally {
        loading.style.display = 'none';
        analyzeBtn.disabled = false;
    }
});

function showResult(text, imageBase64) {
    caption.textContent = text;

    previewImage.src = imageBase64;
//    resultImage.src = imageBase64;
//    resultImage.style.display = 'block';

    result.style.display = 'block';
}

function showError(message) {
    error.textContent = message;
    error.style.display = 'block';
}
