// Пока что этот файл пуст. 
// Здесь будет логика для записи голоса.
document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    tg.expand();

    const recordButton = document.getElementById('record-btn');
    const recordButtonText = recordButton.querySelector('span');
    const textEditor = document.getElementById('text-editor');
    const suggestionsContainer = document.getElementById('suggestions');

    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;

    recordButton.addEventListener('click', async () => {
        if (!isRecording) {
            try {
                // Запрашиваем доступ к микрофону
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);

                // Начинаем запись
                mediaRecorder.start();
                isRecording = true;
                updateButtonState('recording');

                // Собираем данные в массив
                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };

                // Что делать, когда запись остановлена
                mediaRecorder.onstop = () => {
                    isRecording = false;
                    // Создаем Blob из записанных данных
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    
                    // Отправляем аудио на сервер
                    sendAudioToServer(audioBlob);
                    
                    // Очищаем массив для следующей записи
                    audioChunks = [];
                    
                    // Останавливаем все аудиотреки, чтобы выключить индикатор микрофона
                    stream.getTracks().forEach(track => track.stop());
                };

            } catch (err) {
                console.error("Не удалось получить доступ к микрофону:", err);
                alert("Ошибка: не удалось получить доступ к микрофону. Пожалуйста, проверьте разрешения в настройках вашего браузера/устройства.");
            }
        } else {
            // Останавливаем запись
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
        }
    });

    async function sendAudioToServer(blob) {
        const formData = new FormData();
        // Даем файлу уникальное имя с временной меткой
        const fileName = `recording_${Date.now()}.webm`;
        formData.append('audio', blob, fileName);

        updateButtonState('loading');

        try {
            // URL для локального тестирования. Для деплоя см. README.md
            const BACKEND_URL = 'http://127.0.0.1:8000';

            const response = await fetch(`${BACKEND_URL}/upload_audio/`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Сервер ответил:', result);
            
            if (result.transcription) {
                // Вставляем полученный текст в текущую позицию курсора
                const start = textEditor.selectionStart;
                const end = textEditor.selectionEnd;
                const text = textEditor.value;
                const newText = text.substring(0, start) + result.transcription + ' ' + text.substring(end);
                textEditor.value = newText;
                textEditor.selectionStart = textEditor.selectionEnd = start + result.transcription.length + 1;
                textEditor.focus();
                // Показываем кнопки с предложениями
                suggestionsContainer.classList.remove('is-hidden');
            } else if (result.error) {
                throw new Error(`Сервер вернул ошибку: ${result.error}`);
            }
            
        } catch (error) {
            console.error('Ошибка при отправке аудио:', error);
            alert('Не удалось отправить аудио на сервер. Проверьте, запущен ли бэкенд и работает ли интернет.');
        } finally {
            updateButtonState('idle');
        }
    }

    suggestionsContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-suggestion')) {
            const action = e.target.dataset.action;
            const originalText = textEditor.value;

            if (!originalText.trim()) {
                alert("Нет текста для улучшения.");
                return;
            }
            
            e.target.disabled = true;
            e.target.textContent = 'Думаю...';

            try {
                // URL для локального тестирования. Для деплоя см. README.md
                const BACKEND_URL = 'http://127.0.0.1:8000';

                const response = await fetch(`${BACKEND_URL}/improve_text/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text: originalText, action: action })
                });

                if (!response.ok) throw new Error(`Ошибка сервера: ${response.statusText}`);

                const result = await response.json();
                
                if (result.improved_text) {
                    textEditor.value = result.improved_text;
                } else if (result.error) {
                    throw new Error(`Сервер вернул ошибку: ${result.error}`);
                }

            } catch (error) {
                console.error(`Ошибка при улучшении текста (action: ${action}):`, error);
                alert(`Не удалось улучшить текст. ${error.message}`);
            } finally {
                e.target.disabled = false;
                 if (action === 'cleanup') e.target.textContent = 'Убрать запинки и паузы';
                 if (action === 'grammar') e.target.textContent = 'Исправить грамматику';
            }
        }
    });

    function updateButtonState(state) {
        recordButton.disabled = false;
        if (state === 'recording') {
            recordButton.classList.add('is-recording');
            recordButtonText.textContent = 'Остановить запись';
        } else if (state === 'loading') {
            recordButton.disabled = true;
            recordButton.classList.remove('is-recording');
            recordButtonText.textContent = 'Обработка...';
        } else { // idle
            recordButton.classList.remove('is-recording');
            recordButtonText.textContent = 'Начать запись';
        }
    }
});
