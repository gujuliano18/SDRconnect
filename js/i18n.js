/**
 * ======================================================
 * Sistema de Internacionalização (i18n)
 * Suporte a múltiplos idiomas via arquivos JSON
 * ======================================================
 */

class I18n {
    constructor() {
        this.currentLanguage = 'pt-BR';
        this.translations = {};
        this.observers = [];
        this.isLoaded = false;
        this.silentMode = true; // Não exibe warnings no console
        
        this.detectLanguage();
    }

    /**
     * Detecta o idioma preferido do usuário
     */
    detectLanguage() {
        const saved = localStorage.getItem('sdr_language');
        if (saved && (saved === 'pt-BR' || saved === 'en-US')) {
            this.currentLanguage = saved;
            return;
        }

        const browserLang = navigator.language || navigator.languages?.[0] || 'pt-BR';
        if (browserLang.startsWith('pt')) {
            this.currentLanguage = 'pt-BR';
        } else if (browserLang.startsWith('en')) {
            this.currentLanguage = 'en-US';
        } else {
            this.currentLanguage = 'pt-BR';
        }
    }

    /**
     * Carrega o arquivo de tradução para o idioma atual
     */
    async loadLanguage(lang = this.currentLanguage) {
        try {
            const response = await fetch(`/sdr/language/${lang}.json`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.translations = await response.json();
            this.currentLanguage = lang;
            this.isLoaded = true;
            localStorage.setItem('sdr_language', lang);
            this.notifyObservers();
            return this.translations;
        } catch (error) {
            console.error(`Erro ao carregar idioma ${lang}:`, error);
            if (lang !== 'pt-BR') {
                return this.loadLanguage('pt-BR');
            }
            // Fallback: cria traduções vazias
            this.translations = {};
            this.isLoaded = true;
            throw error;
        }
    }

    /**
     * Obtém uma tradução por chave com fallback silencioso
     */
    t(key, params = {}) {
        if (!this.isLoaded || !this.translations) {
            if (!this.silentMode) {
                console.warn(`[i18n] Traduções não carregadas para: ${key}`);
            }
            return this.formatFallback(key, params);
        }

        const keys = key.split('.');
        let value = this.translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                if (!this.silentMode) {
                    console.warn(`[i18n] Chave não encontrada: ${key}`);
                }
                return this.formatFallback(key, params);
            }
        }

        if (typeof value === 'string') {
            return this.formatString(value, params);
        }

        return this.formatFallback(key, params);
    }

    /**
     * Formata uma string com placeholders
     */
    formatString(text, params) {
        return text.replace(/\{(\w+)\}/g, (match, param) => {
            return params[param] !== undefined ? params[param] : match;
        });
    }

    /**
     * Fallback: retorna uma versão legível da chave
     */
    formatFallback(key, params) {
        // Tenta extrair a última parte da chave como texto
        const parts = key.split('.');
        let fallback = parts[parts.length - 1] || key;
        // Substitui underscores por espaços e capitaliza
        fallback = fallback.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        // Substitui placeholders se houver
        if (Object.keys(params).length > 0) {
            fallback = this.formatString(fallback, params);
        }
        
        return fallback;
    }

    /**
     * Registra um observador
     */
    observe(callback) {
        this.observers.push(callback);
        if (this.isLoaded) {
            callback(this);
        }
    }

    /**
     * Notifica observadores
     */
    notifyObservers() {
        for (const callback of this.observers) {
            try {
                callback(this);
            } catch (e) {
                console.error('[i18n] Erro no observador:', e);
            }
        }
    }

    /**
     * Altera o idioma
     */
    async setLanguage(lang) {
        if (lang === this.currentLanguage && this.isLoaded) {
            return;
        }
        await this.loadLanguage(lang);
    }

    /**
     * Retorna o idioma atual
     */
    getLanguage() {
        return this.currentLanguage;
    }

    /**
     * Lista de idiomas disponíveis
     */
    getAvailableLanguages() {
        return [
            { code: 'pt-BR', label: 'Português (BR)' },
            { code: 'en-US', label: 'English (US)' }
        ];
    }
}

// Cria instância global
const i18n = new I18n();

/**
 * Atualiza elementos HTML com data-i18n
 */
function updateI18nElements(i18nInstance) {
    const elements = document.querySelectorAll('[data-i18n]');
    
    for (const el of elements) {
        const key = el.getAttribute('data-i18n');
        const paramsAttr = el.getAttribute('data-i18n-params');
        let params = {};
        
        if (paramsAttr) {
            try {
                params = JSON.parse(paramsAttr);
            } catch (e) {
                // Silencioso - não loga erro de params
            }
        }
        
        const translation = i18nInstance.t(key, params);
        
        // Atualiza o conteúdo mantendo a estrutura HTML
        if (el.children.length === 0) {
            el.textContent = translation;
        } else {
            // Para elementos com filhos, atualiza apenas nós de texto
            const textNodes = [];
            const walker = document.createTreeWalker(
                el,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function(node) {
                        if (node.parentElement && node.parentElement.closest('[data-i18n-ignore]')) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
            );
            
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.trim() !== '') {
                    textNodes.push(node);
                }
            }
            
            if (textNodes.length > 0) {
                // Substitui apenas o primeiro nó de texto significativo
                textNodes[0].textContent = translation;
            } else {
                // Fallback: insere como texto
                el.prepend(translation);
            }
        }
    }
}

// Exporta para uso global
window.i18n = i18n;
window.updateI18nElements = updateI18nElements;