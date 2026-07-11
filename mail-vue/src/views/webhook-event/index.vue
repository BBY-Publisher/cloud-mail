<template>
  <div class="webhook-event-box">
    <div class="header-actions">
      <el-select v-model="params.provider" :placeholder="$t('all')" clearable class="provider-select" @change="onProviderChange">
        <el-option :label="$t('all')" value=""/>
        <el-option label="Resend" value="resend"/>
        <el-option label="Brevo" value="brevo"/>
      </el-select>
      <Icon class="icon" icon="ion:reload" width="18" height="18" @click="loadList"/>
      <el-button class="clear-btn" type="danger" plain v-perm="'webhook-event:clear'" @click="openClear">
        {{ $t('webhookEventClear') }}
      </el-button>
    </div>
    <el-scrollbar class="webhook-scrollbar">
      <el-table :data="events" style="height: 100%;" :empty-text="emptyText" v-loading="loading">
        <el-table-column type="index" width="60"/>
        <el-table-column :label="$t('date')" prop="createTime" min-width="170">
          <template #default="props">
            <span>{{ formatDetailDate(props.row.createTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Provider" width="110">
          <template #default="props">
            <el-tag :type="props.row.provider === 'resend' ? 'success' : 'warning'" size="small">
              {{ props.row.provider }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('eventType')" prop="eventType" min-width="180">
          <template #default="props">
            <span class="event-type">{{ props.row.eventType }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('status')" width="120">
          <template #default="props">
            <el-tag :type="statusTagType(props.row.status)" size="small">
              {{ statusText(props.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('recipient')" prop="recipient" min-width="200">
          <template #default="props">
            <span class="cell-truncate">{{ props.row.recipient || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Reason" min-width="180">
          <template #default="props">
            <span class="cell-truncate" :title="props.row.reason || ''">{{ props.row.reason || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('linkedEmail')" width="100" align="center">
          <template #default="props">
            <el-button v-if="props.row.emailId" link type="primary" @click="openEmail(props.row.emailId)">
              #{{ props.row.emailId }}
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('action')" width="100" align="center">
          <template #default="props">
            <el-button link type="primary" @click="openPayload(props.row)">
              {{ $t('payload') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-scrollbar>

    <div class="pagination" v-if="total > 0">
      <el-pagination
          :current-page="params.num"
          :page-size="params.size"
          :pager-count="pagerCount"
          :page-sizes="[10, 20, 50, 100]"
          background
          :layout="layout"
          :total="total"
          @size-change="sizeChange"
          @current-change="numChange"
      />
    </div>

    <el-dialog v-model="payloadShow" :title="$t('payload')" top="8vh" width="800px">
      <pre class="payload-box">{{ payloadText }}</pre>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, defineOptions, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useEmailStore } from '@/store/email.js';
import { webhookEventList, webhookEventClear, allEmailGet } from '@/request/webhook-event.js';
import { formatDetailDate } from '@/utils/day.js';

defineOptions({ name: 'webhook-event' });

const { t } = useI18n();
const router = useRouter();
const emailStore = useEmailStore();

const events = ref([]);
const total = ref(0);
const loading = ref(false);
const payloadShow = ref(false);
const payloadText = ref('');
const pagerCount = ref(11);
const pageSize = ref('');

const params = ref({
  num: 1,
  size: 20,
  provider: ''
});

const layout = computed(() => 'total, sizes, prev, pager, next, jumper');
const emptyText = computed(() => t('webhookEventEmpty'));

const statusMap = {
  0: { text: 'received', type: 'info' },
  1: { text: 'sent', type: 'info' },
  2: { text: 'delivered', type: 'success' },
  3: { text: 'bounced', type: 'danger' },
  4: { text: 'complained', type: 'warning' },
  5: { text: 'delayed', type: 'warning' },
  8: { text: 'failed', type: 'danger' }
};

function statusText(status) {
  return statusMap[status]?.text || '-';
}

function statusTagType(status) {
  return statusMap[status]?.type || 'info';
}

function numChange(num) {
  params.value.num = num;
  loadList();
}

function sizeChange(size) {
  params.value.size = size;
  params.value.num = 1;
  loadList();
}

function onProviderChange() {
  params.value.num = 1;
  loadList();
}

function loadList() {
  loading.value = true;
  webhookEventList({ ...params.value })
    .then(data => {
      events.value = data.list || [];
      total.value = data.total || 0;
    })
    .finally(() => {
      loading.value = false;
    });
}

function openPayload(row) {
  let parsed = row.payload;
  try {
    parsed = JSON.stringify(JSON.parse(row.payload || '{}'), null, 2);
  } catch (_) {
    parsed = row.payload || '';
  }
  payloadText.value = parsed;
  payloadShow.value = true;
}

function openEmail(emailId) {
  allEmailGet(emailId).then(row => {
    emailStore.contentData.email = row;
    emailStore.contentData.delType = 'physics';
    emailStore.contentData.showStar = false;
    emailStore.contentData.showReply = false;
    router.push({ name: 'content' });
  }).catch(() => {
    /* toast already shown by axios */
  });
}

function openClear() {
  ElMessageBox.confirm(t('webhookEventClearConfirm'), t('warning'), {
    type: 'warning',
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel')
  }).then(() => {
    webhookEventClear().then(() => {
      ElMessage({ message: t('clearSuccess'), type: 'success', plain: true });
      params.value.num = 1;
      loadList();
    });
  }).catch(() => {
    /* user cancelled */
  });
}

onMounted(() => {
  const width = window.innerWidth;
  pagerCount.value = width < 768 ? 7 : 11;
  pageSize.value = width < 380 ? 'small' : '';
  loadList();
});
</script>

<style scoped lang="scss">
.webhook-event-box {
  height: 100%;
  overflow: hidden;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.header-actions {
  padding: 9px 15px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: var(--header-actions-border);

  .icon {
    cursor: pointer;
  }

  .provider-select {
    width: 160px;
  }

  .clear-btn {
    margin-left: auto;
  }
}

.webhook-scrollbar {
  flex: 1;
  min-height: 0;
}

.pagination {
  padding: 12px;
  display: flex;
  justify-content: flex-end;
  box-shadow: var(--header-actions-border);
}

.event-type {
  font-family: monospace;
  font-size: 13px;
}

.cell-truncate {
  display: inline-block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

.payload-box {
  margin: 0;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  max-height: 60vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>