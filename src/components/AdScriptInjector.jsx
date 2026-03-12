import { useEffect } from 'react';
import api from '../api/client';

/**
 * AdScriptInjector
 * Fetches active ad scripts from the server and injects them into <head>.
 * Place this component once at the App root level.
 */
const AdScriptInjector = () => {
    useEffect(() => {
        let mounted = true;

        const loadScripts = async () => {
            try {
                const scripts = await api.get('/iklan/scripts');
                if (!mounted || !Array.isArray(scripts)) return;

                scripts.forEach(({ id, scriptCode, posisi }) => {
                    if (!scriptCode) return;

                    // Create a container div to parse the HTML
                    const container = document.createElement('div');
                    container.innerHTML = scriptCode.trim();

                    // Extract and re-create script elements (innerHTML doesn't execute scripts)
                    const elements = container.querySelectorAll('*');
                    const target = posisi === 'body' ? document.body : document.head;

                    elements.forEach(el => {
                        if (el.tagName === 'SCRIPT') {
                            const script = document.createElement('script');
                            // Copy all attributes
                            Array.from(el.attributes).forEach(attr => {
                                script.setAttribute(attr.name, attr.value);
                            });
                            script.textContent = el.textContent;
                            script.dataset.iklanId = String(id);
                            target.appendChild(script);
                        } else {
                            const clone = el.cloneNode(true);
                            clone.dataset.iklanId = String(id);
                            target.appendChild(clone);
                        }
                    });
                });
            } catch (err) {
                // Silently fail — ads are non-critical
                console.warn('[AdScript] Failed to load scripts:', err.message);
            }
        };

        loadScripts();

        return () => {
            mounted = false;
            // Cleanup injected scripts on unmount
            document.querySelectorAll('[data-iklan-id]').forEach(el => el.remove());
        };
    }, []);

    return null; // This component renders nothing
};

export default AdScriptInjector;
