<template>
  <div class="email-view">
    <MobileAccountSelector />
    <form class="inbox-search" role="search" @submit.prevent="search">
      <el-input v-model="searchValue" clearable
                :placeholder="$t('inboxSearchPlaceholder')"
                :aria-label="$t('inboxSearchPlaceholder')"
                @clear="search">
        <template #prefix><Icon icon="iconoir:search" width="18" /></template>
      </el-input>
      <el-button native-type="submit" type="primary">{{ $t('inboxSearch') }}</el-button>
    </form>
    <emailScroll ref="scroll" :key="listKey"
                 :cancel-success="cancelStar"
                 :star-success="addStar"
                 :getEmailList="getEmailList"
                 :emailDelete="emailDelete"
                 :star-add="starAdd"
                 :star-cancel="starCancel"
                 :time-sort="params.timeSort"
                 :email-read="emailRead"
                 :show-unread="true"
                 actionLeft="4px"
                 @jump="jumpContent"
    >
      <template #first>
        <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-down-outline"
              v-if="params.timeSort === 0" width="28" height="28"/>
        <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-up-outline" v-else
              width="28" height="28"/>
      </template>

    </emailScroll>
  </div>
</template>

<script setup>
import {useAccountStore} from "@/store/account.js";
import {useEmailStore} from "@/store/email.js";
import {useSettingStore} from "@/store/setting.js";
import emailScroll from "@/components/email-scroll/index.vue"
import MobileAccountSelector from "@/components/mobile-account-selector/index.vue"
import {emailList, emailDelete, emailLatest, emailRead} from "@/request/email.js";
import {starAdd, starCancel} from "@/request/star.js";
import {computed, defineOptions, onMounted, onUnmounted, reactive, ref, watch} from "vue";
import {sleep} from "@/utils/time-utils.js";
import router from "@/router/index.js";
import {Icon} from "@iconify/vue";
import { useRoute } from 'vue-router'

defineOptions({
  name: 'email'
})

const route = useRoute();
const emailStore = useEmailStore();
const accountStore = useAccountStore();
const settingStore = useSettingStore();
const scroll = ref({})
const params = reactive({
  timeSort: 0,
  keyword: '',
})

const searchValue = ref('');
const listKey = computed(() => JSON.stringify([
  accountStore.currentAccountId, accountStore.currentAccount.allReceive,
  params.timeSort, params.keyword
]));
let disposed = false;
onUnmounted(() => { disposed = true; });

function search() {
  params.keyword = searchValue.value.trim();
}

onMounted(() => {
  emailStore.emailScroll = scroll;
  latest()
})


watch(listKey, () => { existIds.clear(); })

function changeTimeSort() {
  params.timeSort = params.timeSort ? 0 : 1
}

function jumpContent(email) {
  emailStore.contentData.email = email
  emailStore.contentData.delType = 'logic'
  emailStore.contentData.showUnread = true
  emailStore.contentData.showStar = true
  emailStore.contentData.showReply = true
  router.push('/message')
}

const existIds = new Set();

async function latest() {
  while (!disposed) {

    let autoRefresh = settingStore.settings.autoRefresh;
    await sleep(autoRefresh > 1 ? autoRefresh * 1000 : 3000);

    if (disposed || route.name !== 'email' || params.keyword) {
      continue;
    }

    const latestId = scroll.value.latestEmail?.emailId

    if (!scroll.value.firstLoad && autoRefresh > 1) {
      try {
        const currentScroll = scroll.value;
        const requestKey = listKey.value;
        const accountId = accountStore.currentAccountId
        const allReceive = scroll.value.latestEmail?.allReceive
        const curTimeSort = params.timeSort
        let list = []

        //确保发起请求时最后一个邮件是当前账号的,或者
        if (accountId === scroll.value.latestEmail?.reqAccountId) {
          list = await emailLatest(latestId, accountId, allReceive);
        }

        //确保请求回来后，账号没有切换，时间排序没有改变，全部邮件类型没变
        if (!disposed && !params.keyword && currentScroll === scroll.value && requestKey === listKey.value && accountId === accountStore.currentAccountId && params.timeSort === curTimeSort && allReceive === accountStore.currentAccount.allReceive) {
          if (list.length > 0) {

            for (let email of list) {
              if (disposed || params.keyword || currentScroll !== scroll.value || requestKey !== listKey.value) break;

              email.reqAccountId = accountId;
              email.allReceive = allReceive;

              if (!existIds.has(email.emailId)) {

                existIds.add(email.emailId)
                scroll.value.addItem(email)

                await sleep(50)
              }

            }

          }

        }
      } catch (e) {
        if (e.code === 401 || e.code === 403) {
          settingStore.settings.autoRefresh = 0;
        }
        console.error(e)
      }
    }
  }
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
  return emailList(accountId, allReceive, emailId, params.timeSort, size, 0, params.keyword).then(data => {
    data.latestEmail.reqAccountId = accountId;
    data.latestEmail.allReceive = allReceive;
    return data;
  })
}

</script>
<style scoped>
.inbox-search {
  display: flex;
  gap: 8px;
  padding: 10px 15px;
}

.inbox-search .el-input {
  min-width: 0;
  max-width: 520px;
}

.email-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.email-view :deep(.email-container) {
  flex: 1;
  min-height: 0;
}
</style>

<style>
.icon {
  cursor: pointer;
}
</style>
