let translateTimeout;
let currentSpeech = null;

// Theme toggle functionality
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.querySelector('#themeToggle i');
    
    if (body.classList.contains('light-theme')) {
        body.classList.replace('light-theme', 'dark-theme');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
        localStorage.setItem('theme', 'dark');
    } else {
        body.classList.replace('dark-theme', 'light-theme');
        themeIcon.classList.replace('fa-sun', 'fa-moon');
        localStorage.setItem('theme', 'light');
    }
}

// Auto-resize textarea function
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

// Clear text function
function clearText(type) {
    const textarea = document.getElementById(`${type}Text`);
    textarea.value = '';
    document.getElementById(`${type}Count`).textContent = '0/1000';
    autoResize(textarea);
    
    // If clearing source, also clear target
    if (type === 'source') {
        clearText('target');
    }
}

// Language detection function
async function detectLanguage(text) {
    try {
        const response = await fetch(`${CONFIG.DETECT_API_URL}?key=${CONFIG.API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ q: text })
        });
        const data = await response.json();
        return data.data.detections[0][0].language;
    } catch (error) {
        console.error('Language detection failed:', error);
        return 'en';
    }
}

// Text direction setting function
function setTextDirection(lang, elementId) {
    const element = document.getElementById(elementId);
    const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
    element.dir = rtlLanguages.includes(lang) ? 'rtl' : 'ltr';
}

// Google Cloud Text-to-Speech implementation
async function googleTextToSpeech(text, lang) {
    try {
        const response = await fetch(`${CONFIG.TTS_API_URL}?key=${CONFIG.API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input: { text },
                voice: { languageCode: lang, ssmlGender: 'NEUTRAL' },
                audioConfig: { audioEncoding: 'MP3' }
            })
        });

        const data = await response.json();
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        
        if (currentSpeech) {
            currentSpeech.pause();
        }
        
        currentSpeech = audio;
        audio.play();
        
        return audio;
    } catch (error) {
        console.error('Text-to-speech error:', error);
        fallbackTextToSpeech(text, lang);
    }
}

// Fallback to browser's built-in TTS
function fallbackTextToSpeech(text, lang) {
    if ('speechSynthesis' in window) {
        if (currentSpeech) {
            speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === 'auto' ? 'en' : lang;
        speechSynthesis.speak(utterance);
        currentSpeech = utterance;
    }
}

// Main translation function
async function translateText() {
    const sourceText = document.getElementById('sourceText').value.trim();
    const sourceLang = document.getElementById('sourceLang').value;
    const targetLang = document.getElementById('targetLang').value;
    const translateBtn = document.getElementById('translateBtn');

    if (!sourceText) return;

    translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating...';
    translateBtn.disabled = true;

    try {
        // Detect language if set to auto
        let actualSourceLang = sourceLang;
        if (sourceLang === 'auto') {
            actualSourceLang = await detectLanguage(sourceText);
            document.getElementById('sourceLang').value = actualSourceLang;
        }

        // Perform translation
        const response = await fetch(`${CONFIG.TRANSLATE_API_URL}?key=${CONFIG.API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: sourceText,
                source: actualSourceLang === 'auto' ? null : actualSourceLang,
                target: targetLang,
                format: 'text'
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        const translatedText = data.data.translations[0].translatedText;
        const targetTextarea = document.getElementById('targetText');
        targetTextarea.value = translatedText;
        
        // Set text direction based on languages
        setTextDirection(actualSourceLang, 'sourceText');
        setTextDirection(targetLang, 'targetText');
        
        document.getElementById('targetCount').textContent = `${translatedText.length}/1000`;
        autoResize(targetTextarea);

    } catch (error) {
        console.error('Translation error:', error);
        document.getElementById('targetText').value = 'Translation failed. Please try again.';
    } finally {
        translateBtn.innerHTML = '<i class="fas fa-language"></i> Translate';
        translateBtn.disabled = false;
    }
}

// Speak text function
async function speakText(type) {
    const text = document.getElementById(`${type}Text`).value;
    const lang = document.getElementById(`${type}Lang`).value;
    
    if (!text) return;
    
    const button = document.querySelector(`[onclick="speakText('${type}')"]`);
    button.innerHTML = '<i class="fas fa-stop"></i> Stop';
    
    try {
        const audio = await googleTextToSpeech(text, lang);
        
        audio.onended = () => {
            button.innerHTML = `<i class="fas fa-volume-up"></i> Listen ${type === 'source' ? 'Source' : 'Translation'}`;
        };

        // Add click handler to stop audio
        button.onclick = () => {
            audio.pause();
            currentSpeech = null;
            button.innerHTML = `<i class="fas fa-volume-up"></i> Listen ${type === 'source' ? 'Source' : 'Translation'}`;
            button.onclick = () => speakText(type);
        };
    } catch (error) {
        button.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed';
        setTimeout(() => {
            button.innerHTML = `<i class="fas fa-volume-up"></i> Listen ${type === 'source' ? 'Source' : 'Translation'}`;
        }, 2000);
    }
}

// Swap languages function
function swapLanguages() {
    const sourceLang = document.getElementById('sourceLang');
    const targetLang = document.getElementById('targetLang');
    const sourceText = document.getElementById('sourceText');
    const targetText = document.getElementById('targetText');

    if (sourceLang.value !== 'auto') {
        [sourceLang.value, targetLang.value] = [targetLang.value, sourceLang.value];
        [sourceText.value, targetText.value] = [targetText.value, sourceText.value];
        
        document.getElementById('sourceCount').textContent = `${sourceText.value.length}/1000`;
        document.getElementById('targetCount').textContent = `${targetText.value.length}/1000`;
        
        autoResize(sourceText);
        autoResize(targetText);

        // Update text direction after swap
        setTextDirection(sourceLang.value, 'sourceText');
        setTextDirection(targetLang.value, 'targetText');
    }
}

// Copy translation function
function copyTranslation() {
    const targetText = document.getElementById('targetText');
    targetText.select();
    document.execCommand('copy');
    
    const copyBtn = document.querySelector('.action-btn:last-child');
    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => {
        copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
    }, 2000);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.add(`${savedTheme}-theme`);
    if (savedTheme === 'dark') {
        document.querySelector('#themeToggle i').classList.replace('fa-moon', 'fa-sun');
    }

    // Theme toggle button
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Initialize text direction
    setTextDirection(document.getElementById('sourceLang').value, 'sourceText');
    setTextDirection(document.getElementById('targetLang').value, 'targetText');
    
    // Character counter with auto-translate
    document.getElementById('sourceText').addEventListener('input', function(e) {
        const count = e.target.value.length;
        const countDisplay = document.getElementById('sourceCount');
        
        countDisplay.textContent = `${count}/1000`;
        
        if (count >= 900) {
            countDisplay.classList.add('char-limit-warning');
        } else {
            countDisplay.classList.remove('char-limit-warning');
        }
        
        if (count > 1000) {
            e.target.value = e.target.value.substring(0, 1000);
            return;
        }
        
        autoResize(e.target);
        
        clearTimeout(translateTimeout);
        if (count > 0) {
            translateTimeout = setTimeout(translateText, 1000);
        }
    });

    // Language selection change handlers
    document.getElementById('sourceLang').addEventListener('change', () => {
        setTextDirection(document.getElementById('sourceLang').value, 'sourceText');
        if (document.getElementById('sourceText').value) {
            translateText();
        }
    });

    document.getElementById('targetLang').addEventListener('change', () => {
        setTextDirection(document.getElementById('targetLang').value, 'targetText');
        if (document.getElementById('sourceText').value) {
            translateText();
        }
    });

    // Initialize auto-resize for both textareas
    document.querySelectorAll('textarea').forEach(textarea => {
        textarea.addEventListener('input', () => autoResize(textarea));
        autoResize(textarea);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to translate
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            translateText();
        }
        
        // Alt + S to speak source text
        if (e.altKey && e.key === 's') {
            e.preventDefault();
            speakText('source');
        }
        
        // Alt + T to speak translated text
        if (e.altKey && e.key === 't') {
            e.preventDefault();
            speakText('target');
        }
        
        // Alt + W to swap languages
        if (e.altKey && e.key === 'w') {
            e.preventDefault();
            swapLanguages();
        }
        
        // Ctrl/Cmd + Shift + C to copy translation
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            copyTranslation();
        }

        // Escape key to stop speech
        if (e.key === 'Escape' && currentSpeech) {
            currentSpeech.pause();
            currentSpeech = null;
            document.querySelectorAll('[onclick^="speakText"]').forEach(btn => {
                btn.innerHTML = `<i class="fas fa-volume-up"></i> Listen ${btn.getAttribute('onclick').includes('source') ? 'Source' : 'Translation'}`;
            });
        }
    });
});