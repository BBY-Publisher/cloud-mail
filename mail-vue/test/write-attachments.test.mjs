import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { toForwardAttachments } from '../src/utils/forward-attachments.js';
import { getCcAddresses } from '../src/utils/reply-recipients.js';

// Mount the real SFC and its template. Only stores, services, and child widgets
// are replaced; attachment initialization, rendering, and removal stay real.
const workerRequire = createRequire(new URL('../../mail-worker/package.json', import.meta.url));
const vueRequire = createRequire(new URL('../package.json', import.meta.url));
const { parseHTML } = workerRequire('linkedom');
const { window } = parseHTML('<html><body></body></html>');
for (const name of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Node']) {
    globalThis[name] = name === 'window' ? window : window[name];
}
const Vue = vueRequire('vue');
const { parse, compileScript } = vueRequire('vue/compiler-sfc');
const filename = new URL('../src/layout/write/index.vue', import.meta.url);
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname });
const compiled = compileScript(descriptor, { id: 'write-attachments-test', inlineTemplate: true });
const code = compiled.content.replace(/^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/gm,
    (_, bindings, source) => {
        const binding = bindings.trim();
        return binding.startsWith('{')
            ? `const ${binding.replace(/\bas\b/g, ':')} = modules[${JSON.stringify(source)}];`
            : `const ${binding} = modules[${JSON.stringify(source)}].default;`;
    }).replace('export default', 'return');

const Widget = { setup(_, { slots }) { return () => Vue.h('div', slots.default?.()); } };
const Editor = {
    props: ['defValue'],
    setup(props, { expose }) {
        const content = Vue.ref(props.defValue || '');
        Vue.watch(() => props.defValue, value => { content.value = value || ''; });
        expose({ clearEditor() { content.value = ''; }, focus() {}, getContent: () => content.value });
        return () => Vue.h('article', { innerHTML: content.value });
    }
};

function mountWriter({ onSend } = {}) {
    const account = { email: 'sender@example.com', accountId: 1, name: 'Sender' };
    let draftPrompts = 0;
    const modules = {
        vue: Vue,
        '@iconify/vue': { Icon: { render: () => Vue.h('span', { class: 'test-icon' }) } },
        '@/components/tiny-editor/index.vue': { default: Editor },
        '@/components/shadow-html/index.vue': { default: Widget },
        '@/components/send-percent/index.vue': { default: Widget },
        '@/store/user.js': { useUserStore: () => ({ user: { ...account, account } }) },
        '@/store/account.js': { useAccountStore: () => ({ currentAccount: account }) },
        '@/store/email.js': { useEmailStore: () => ({}) },
        '@/store/setting.js': { useSettingStore: () => ({ settings: {} }) },
        '@/store/draft.js': { userDraftStore: () => ({}) },
        '@/store/writer.js': { useWriterStore: () => ({ sendRecipientRecord: [] }) },
        '@/store/signature.js': { useSignatureStore: () => ({ refresh: 0 }) },
        '@/request/email.js': { attachmentUpload() { assert.fail('unexpected upload'); },
            emailSend(form) {
                if (!onSend) assert.fail('unexpected send');
                onSend(JSON.parse(JSON.stringify(form)));
                return new Promise(() => {});
            } },
        '@/request/signature.js': { signatureGet: async () => ({}) },
        '@/utils/forward-attachments.js': { toForwardAttachments },
        '@/utils/reply-recipients.js': { getCcAddresses },
        '@/utils/verify-utils.js': { isEmail: () => true },
        '@/utils/file-utils.js': { fileToBase64() {}, formatBytes: size => `${size} B` },
        '@/utils/icon-utils.js': { getIconByName: () => ({}) },
        '@/utils/convert.js': { toOssDomain: () => '' },
        '@/utils/day.js': { formatDetailDate: () => '2026-09-11' },
        '@/utils/compose-upload.js': { classifyComposeFiles() {}, isImageUpload() {} },
        '@/db/db.js': { default: { value: {} } },
        '@/router/index.js': { default: {} },
        dayjs: { default() {} },
        'vue-i18n': { useI18n: () => ({ t: key => key }) },
        'element-plus': { ElMessageBox: { confirm() {
            draftPrompts++;
            return new Promise(() => {});
        } } }
    };
    const component = new Function('modules', code)(modules);
    const app = Vue.createApp(component);
    app.config.globalProperties.$t = key => key;
    for (const name of ['el-select', 'el-option', 'el-input', 'el-checkbox',
        'el-button', 'el-table', 'el-table-column']) app.component(name, Widget);
    app.component('el-input-tag', {
        props: ['modelValue'],
        emits: ['update:modelValue'],
        setup(props, { slots, emit }) {
            return () => Vue.h('div', {
                class: 'test-recipient-field',
                'data-recipients': JSON.stringify(props.modelValue),
            }, [slots.prefix?.(), slots.default?.(), slots.suffix?.(), Vue.h('button', {
                class: 'remove-recipient',
                onClick: () => emit('update:modelValue', props.modelValue.slice(0, -1)),
            }, 'Remove recipient')]);
        },
    });
    app.component('el-dialog', { render: () => null });
    const root = document.createElement('div');
    document.body.append(root);
    const writer = app.mount(root);
    return { root, writer, draftPrompts: () => draftPrompts, unmount() { app.unmount(); root.remove(); } };
}

const source = {
    emailId: 42, subject: 'test forward mail', sendEmail: 'author@example.com', name: 'Author',
    content: '<p>test for attachments</p>', recipient: '[]',
    attList: [
        { attId: 1, filename: 'clip.mp4', size: 100, type: 0, contentId: '<video-1>' },
        { attId: 2, filename: 'original.mov', size: 200, type: 0, contentId: '<video-2>' }
    ]
};
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 20)); await Vue.nextTick(); };

for (const action of ['openForward', 'openReply', 'openReplyAll']) {
    test(`${action} displays the source files before sending and allows removal`, async () => {
        const view = mountWriter();
        try {
            assert.equal(view.root.querySelector('.send').style.display, 'none');
            view.writer[action](structuredClone(source));
            await settle();
            assert.notEqual(view.root.querySelector('.send').style.display, 'none');
            assert.deepEqual([...view.root.querySelectorAll('.att-filename')].map(node => node.textContent),
                ['clip.mp4', 'original.mov']);
            assert.match(view.root.querySelector('article').textContent, /test for attachments/);
            view.root.querySelector('.att-item > .test-icon:last-child').click();
            await Vue.nextTick();
            assert.deepEqual([...view.root.querySelectorAll('.att-filename')].map(node => node.textContent),
                ['original.mov']);
            view.root.querySelector('.title > div:last-child').click();
            assert.equal(view.draftPrompts(), 1, 'attachment-only edits must prompt to save a draft');
            assert.equal(source.attList.length, 2);
        } finally { view.unmount(); }
    });
}

test('switching reply/forward replaces attachments and handles messages without attachments', async () => {
    const view = mountWriter();
    try {
        view.writer.openForward(structuredClone(source));
        await settle();
        view.writer.openReply({ ...source, attList: [source.attList[1]] });
        await settle();
        assert.deepEqual([...view.root.querySelectorAll('.att-filename')].map(node => node.textContent), ['original.mov']);
        view.writer.openForward({ ...source, attList: [] });
        await settle();
        assert.equal(view.root.querySelectorAll('.att-item').length, 0);
    } finally { view.unmount(); }
});

const ccRecipients = [
    { address: 'first@example.com', name: 'First' },
    { address: 'second@example.com', name: 'Second' },
];
const withCc = { ...source, cc: JSON.stringify(ccRecipients), bcc: '[{"address":"hidden@example.com"}]' };
const recipients = root => [...root.querySelectorAll('.test-recipient-field')]
    .map(node => JSON.parse(node.getAttribute('data-recipients')));

test('reply all opens an editable CC field and sends the original sender plus every CC address', async () => {
    let sent;
    const view = mountWriter({ onSend: form => { sent = form; } });
    const original = structuredClone(withCc);
    const previousMessage = globalThis.ElMessage;
    globalThis.ElMessage = () => ({ close() {} });
    try {
        view.writer.openReplyAll(original);
        await settle();
        assert.deepEqual(recipients(view.root), [
            ['author@example.com'], ['first@example.com', 'second@example.com'],
        ]);
        assert.match(view.root.querySelector('article').textContent, /test for attachments/);
        const send = [...view.root.querySelectorAll('.send-actions > div')]
            .find(node => node.textContent === 'reply');
        assert.ok(send, 'reply send action is rendered');
        send.click();
        await Vue.nextTick();
        assert.deepEqual(sent.receiveEmail, ['author@example.com']);
        assert.deepEqual(sent.cc, ['first@example.com', 'second@example.com']);
        assert.deepEqual(sent.bcc, []);
        assert.equal(sent.sendType, 'reply');
        assert.equal(sent.emailId, source.emailId);
        assert.deepEqual(original, withCc, 'the original email is preserved');
    } finally {
        globalThis.ElMessage = previousMessage;
        view.unmount();
    }
});

test('closing an unchanged reply all does not prompt, while editing CC prompts to save', async () => {
    const view = mountWriter();
    try {
        view.writer.openReplyAll(structuredClone(withCc));
        await settle();
        view.root.querySelector('.title > div:last-child').click();
        assert.equal(view.draftPrompts(), 0);
        view.writer.openReplyAll(structuredClone(withCc));
        await settle();
        view.root.querySelectorAll('.remove-recipient')[1].click();
        await Vue.nextTick();
        assert.deepEqual(recipients(view.root)[1], ['first@example.com']);
        view.root.querySelector('.title > div:last-child').click();
        assert.equal(view.draftPrompts(), 1);
    } finally { view.unmount(); }
});

test('ordinary reply and forward clear CC after reply all, including when switching source messages', async () => {
    const view = mountWriter();
    try {
        for (const action of ['openReply', 'openForward', 'openReplyAll']) {
            view.writer.openReplyAll(structuredClone(withCc));
            await settle();
            view.writer[action]({ ...source, cc: action === 'openReplyAll' ? '[]' : withCc.cc });
            await settle();
            assert.equal(recipients(view.root).length, 1, `${action} hides the empty CC field`);
        }
    } finally { view.unmount(); }
});
