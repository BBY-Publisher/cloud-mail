import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { getCcAddresses } from '../src/utils/reply-recipients.js';
import en from '../src/i18n/en.js';

const workerRequire = createRequire(new URL('../../mail-worker/package.json', import.meta.url));
const vueRequire = createRequire(new URL('../package.json', import.meta.url));
const { window } = workerRequire('linkedom').parseHTML('<html><body></body></html>');
for (const name of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Node']) {
    globalThis[name] = name === 'window' ? window : window[name];
}
const Vue = vueRequire('vue');
const { parse, compileScript } = vueRequire('vue/compiler-sfc');
const filename = new URL('../src/views/content/index.vue', import.meta.url);
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname });
const code = compileScript(descriptor, { id: 'content-reply-all-test', inlineTemplate: true }).content
    .replace(/^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/gm, (_, bindings, source) => {
        const binding = bindings.trim();
        return binding.startsWith('{')
            ? `const ${binding.replace(/\bas\b/g, ':')} = modules[${JSON.stringify(source)}];`
            : `const ${binding} = modules[${JSON.stringify(source)}].default;`;
    }).replace('export default', 'return');
const permissionCode = readFileSync(new URL('../src/perm/perm.js', import.meta.url), 'utf8')
    .replace(/^import .*;$/m, '')
    .replace('export default', 'const directive =')
    .replaceAll('export function', 'function') + '\nreturn directive;';
const Widget = { setup(_, { slots }) { return () => Vue.h('div', slots.default?.()); } };

function mountContent(cc, { showReply = true, canSend = true } = {}) {
    const email = { emailId: 1, cc, attList: [], recipient: '[]', sendEmail: 'author@example.com' };
    const calls = [];
    const modules = {
        vue: Vue,
        'vue-router': { useRouter: () => ({}) },
        'vue-i18n': { useI18n: () => ({ t: key => en[key] || key }) },
        '@iconify/vue': { Icon: {
            props: ['icon'],
            setup(props) { return () => Vue.h('span', { 'data-icon': props.icon }); },
        } },
        'element-plus': {},
        '@/components/shadow-html/index.vue': { default: Widget },
        '@/store/email.js': { useEmailStore: () => ({ contentData: { email, showReply } }) },
        '@/store/account.js': { useAccountStore: () => ({ currentAccount: {} }) },
        '@/store/setting.js': { useSettingStore: () => ({ settings: {} }) },
        '@/store/ui.js': { useUiStore: () => ({ writerRef: {
            openReply: value => calls.push(['reply', value]),
            openReplyAll: value => calls.push(['replyAll', value]),
        } }) },
        '@/request/email.js': {},
        '@/request/star.js': {},
        '@/request/all-email.js': {},
        '@/utils/day.js': { formatDetailDate: () => '' },
        '@/utils/file-utils.js': {},
        '@/utils/convert.js': {},
        '@/utils/icon-utils.js': {},
        '@/utils/reply-recipients.js': { getCcAddresses },
        '@/enums/email-enum.js': {},
    };
    const app = Vue.createApp(new Function('modules', code)(modules));
    app.config.globalProperties.$t = key => en[key] || key;
    app.directive('perm', new Function('useUserStore', permissionCode)(() => ({
        user: { permKeys: canSend ? ['email:send'] : [] },
    })));
    app.component('el-scrollbar', Widget);
    app.component('el-button', { setup(_, { slots }) { return () => Vue.h('button', slots.default?.()); } });
    app.component('el-alert', Widget);
    app.component('el-image-viewer', Widget);
    const root = document.createElement('div');
    document.body.append(root);
    app.mount(root);
    return { root, email, calls, unmount() { app.unmount(); root.remove(); } };
}

test('reply all is hidden without CC addresses or without reply/send access', () => {
    for (const cc of [undefined, null, '', '[]', [], 'invalid JSON', '{}', '[null, {"name":"No address"}, " "]']) {
        const view = mountContent(cc);
        try { assert.equal(view.root.querySelector('.reply-all'), null); }
        finally { view.unmount(); }
    }
    for (const options of [{ showReply: false }, { canSend: false }]) {
        const view = mountContent('[{"address":"cc@example.com"}]', options);
        try { assert.equal(view.root.querySelector('.reply-all'), null); }
        finally { view.unmount(); }
    }
});

test('reply all appears beside reply and opens the reply all composer for the selected email', () => {
    for (const cc of ['[{"address":"cc@example.com"}]', [{ address: 'cc@example.com' }]]) {
        const view = mountContent(cc);
        try {
            const button = view.root.querySelector('.reply-all');
            assert.equal(button.textContent, 'reply all');
            assert.equal(button.previousElementSibling.getAttribute('data-icon'), 'la:reply');
            assert.equal(button.nextElementSibling.getAttribute('data-icon'), 'iconoir:arrow-up-right');
            button.click();
            button.previousElementSibling.click();
            assert.deepEqual(view.calls, [['replyAll', view.email], ['reply', view.email]]);
        } finally { view.unmount(); }
    }
});
