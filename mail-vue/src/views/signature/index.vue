<template>
  <div class="signature-box">
    <div class="header-actions">
      <Icon class="icon" icon="ion:reload" width="18" height="18" @click="loadList"/>
    </div>
    <el-scrollbar class="signature-scrollbar">
      <el-table :data="signatures" style="height: 100%;" :empty-text="''" v-loading="loading">
        <el-table-column width="10"/>
        <el-table-column :label="$t('domain')" prop="domain" min-width="180">
          <template #default="props">
            <span>@{{ props.row.domain }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('status')" width="120">
          <template #default="props">
            <el-tag :type="props.row.enabled ? 'success' : 'info'">
              {{ props.row.enabled ? $t('enabled') : $t('disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('preview')" min-width="220">
          <template #default="props">
            <div class="content-preview">{{ contentText(props.row.content) || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('action')" width="120">
          <template #default="props">
            <el-button size="small" type="primary" @click="openEditor(props.row)">
              {{ $t('change') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-scrollbar>

    <el-dialog v-model="editorShow" :title="`${$t('signature')} - @${form.domain}`" top="5vh" @closed="resetForm">
      <div class="signature-form">
        <div class="signature-switch">
          <span>{{ $t('status') }}</span>
          <el-switch v-model="form.enabled" :active-value="1" :inactive-value="0"/>
        </div>
        <tinyEditor :def-value="editorValue" ref="editor" @change="contentChange"/>
        <div class="dialog-actions">
          <el-button @click="openPreview">{{ $t('preview') }}</el-button>
          <el-button v-perm="'signature:set'" type="primary" :loading="saving" @click="saveSignature">
            {{ $t('save') }}
          </el-button>
        </div>
      </div>
    </el-dialog>

    <el-dialog v-model="previewShow" :title="$t('preview')" top="8vh">
      <div class="preview-box">
        <shadowHtml :html="previewHtml"/>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, defineOptions, nextTick, reactive, ref } from 'vue';
import { Icon } from '@iconify/vue';
import tinyEditor from '@/components/tiny-editor/index.vue';
import shadowHtml from '@/components/shadow-html/index.vue';
import { signatureList, signatureSet } from '@/request/signature.js';
import { useI18n } from 'vue-i18n';
import { useSignatureStore } from '@/store/signature.js';

defineOptions({
  name: 'signature'
})

const { t } = useI18n();
const signatureStore = useSignatureStore();
const signatures = ref([]);
const loading = ref(false);
const saving = ref(false);
const editorShow = ref(false);
const previewShow = ref(false);
const editor = ref({});
const editorValue = ref('');
const form = reactive({
  domain: '',
  content: '',
  enabled: 1
});

const previewHtml = computed(() => form.content || '');

loadList();

function loadList() {
  loading.value = true;
  signatureList().then(list => {
    signatures.value = list;
  }).finally(() => {
    loading.value = false;
  });
}

function openEditor(row) {
  form.domain = row.domain;
  form.content = row.content || '';
  form.enabled = row.enabled ?? 1;
  editorValue.value = '';
  editorShow.value = true;
  nextTick(() => {
    editorValue.value = form.content;
  });
}

function contentChange(content) {
  form.content = content;
}

function openPreview() {
  form.content = editor.value.getContent();
  previewShow.value = true;
}

function saveSignature() {
  form.content = editor.value.getContent();
  saving.value = true;
  signatureSet({...form}).then(() => {
    ElMessage({
      message: t('saveSuccessMsg'),
      type: 'success',
      plain: true
    });
    signatureStore.refreshSignature();
    editorShow.value = false;
    loadList();
  }).finally(() => {
    saving.value = false;
  });
}

function resetForm() {
  form.domain = '';
  form.content = '';
  form.enabled = 1;
  previewShow.value = false;
}

function contentText(content = '') {
  return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
</script>

<style scoped lang="scss">
.signature-box {
  height: 100%;
  overflow: hidden;
  width: 100%;

  .signature-scrollbar {
    height: calc(100% - 42px);
  }
}

.header-actions {
  padding: 9px 15px;
  display: flex;
  align-items: center;
  gap: 18px;
  box-shadow: var(--header-actions-border);
  font-size: 18px;

  .icon {
    cursor: pointer;
  }
}

.content-preview {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.signature-form {
  height: min(600px, calc(90vh - 160px));
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 14px;
}

.signature-switch {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.preview-box {
  height: min(520px, calc(80vh - 120px));
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 12px;
  overflow: auto;
}

:deep(.el-dialog) {
  width: min(860px, calc(100% - 40px)) !important;
}
</style>
