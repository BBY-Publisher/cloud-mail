<template>
  <emailScroll ref="sendScroll"
               :cancel-success="cancelStar"
               :star-success="addStar"
               :getEmailList="getEmailList"
               :emailDelete="emailDelete"
               :star-add="starAdd"
               show-status
               actionLeft="4px"
               :star-cancel="starCancel"
               @jump="jumpContent"
               :time-sort="params.timeSort"
               :type="'send'"
  >
    <template #first>
      <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-down-outline"
            v-if="params.timeSort === 0" width="28" height="28"/>
      <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-up-outline" v-else
            width="28" height="28"/>
      <el-tooltip :content="$t('sync')" placement="bottom" v-if="canSync">
        <Icon class="icon" :class="{'icon-loading': params.syncing}" @click="onSync"
              icon="material-symbols-light:sync" width="28" height="28"/>
      </el-tooltip>
    </template>
  </emailScroll>
</template>

<script setup>
import {useAccountStore} from "@/store/account.js";
import {useEmailStore} from "@/store/email.js";
import emailScroll from "@/components/email-scroll/index.vue"
import {emailList, emailDelete, emailSync} from "@/request/email.js";
import {starAdd, starCancel} from "@/request/star.js";
import {computed, defineOptions, onMounted, reactive, ref, watch} from "vue";
import router from "@/router/index.js";
import {Icon} from "@iconify/vue";
import {useSettingStore} from "@/store/setting.js";
import {useI18n} from "vue-i18n";
import {hasPerm} from "@/perm/perm.js";
import {ElMessage, ElMessageBox} from "element-plus";

defineOptions({
  name: 'send'
})

const { t } = useI18n();
const emailStore = useEmailStore();
const accountStore = useAccountStore();
const settingStore = useSettingStore();
const sendScroll = ref({})
const params = reactive({
  timeSort: 0,
  syncing: false
})

const canSync = computed(() => {
  return hasPerm('email:sync') && settingStore.settings.send !== 0;
});

onMounted(() => {
  emailStore.sendScroll = sendScroll;
})

watch(() => accountStore.currentAccountId, () => {
  sendScroll.value.refreshList();
})

function changeTimeSort() {
  params.timeSort = params.timeSort ? 0 : 1
  sendScroll.value.refreshList();
}

async function onSync() {
  if (params.syncing) return;

  try {
    await ElMessageBox.confirm(t('syncConfirm'), t('sync'), {
      confirmButtonText: t('confirm'),
      cancelButtonText: t('cancel'),
      type: 'warning'
    });
  } catch (_) {
    return;
  }

  params.syncing = true;

  try {
    const data = await emailSync();
    const inserted = data?.inserted || 0;
    const skipped = data?.skipped || 0;
    const errors = data?.errors || [];

    if (errors.length > 0) {
      console.warn('sync errors:', errors);
    }

    ElMessage({
      type: inserted > 0 ? 'success' : 'info',
      message: t('syncSuccess', { inserted, skipped })
    });

    sendScroll.value.refreshList();
  } catch (e) {
    ElMessage({
      type: 'error',
      message: t('syncFailed')
    });
  } finally {
    params.syncing = false;
  }
}

function jumpContent(email) {
  emailStore.contentData.email = email
  emailStore.contentData.delType = 'logic'
  emailStore.contentData.showStar = true
  emailStore.contentData.showReply = true
  router.push('/message')
}

function addStar(email) {
  emailStore.starScroll?.addItem(email)
}

function cancelStar(email) {
  emailStore.starScroll?.deleteEmail([email.emailId])
}

function getEmailList(emailId, size) {
  const accountId =  accountStore.currentAccountId;
  const allReceive = accountStore.currentAccount.allReceive;
  return emailList(accountId, allReceive, emailId, params.timeSort, size, 1).then(data => {
    data.latestEmail.reqAccountId = accountId;
    data.latestEmail.allReceive = allReceive;
    return data;
  })
}

</script>

<style scoped>
.icon {
  cursor: pointer;
}

.icon-loading {
  animation: spin 1s linear infinite;
  pointer-events: none;
  opacity: 0.6;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
