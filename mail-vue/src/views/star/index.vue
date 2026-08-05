<template>
  <div class="email-view">
    <MobileAccountSelector />
    <emailScroll type="star" ref="scroll"
                 :allow-star="false"
                 :cancel-success="cancelStar"
                 :getEmailList="starList"
                 :emailDelete="emailDelete"
                 :star-add="starAdd"
                 :star-cancel="starCancel"
                 @jump="jumpContent"
                 actionLeft="6px"
                 :show-account-icon="false"
    />
  </div>
</template>

<script setup>
import emailScroll from "@/components/email-scroll/index.vue"
import MobileAccountSelector from "@/components/mobile-account-selector/index.vue"
import {emailDelete} from "@/request/email.js";
import {starAdd, starCancel, starList} from "@/request/star.js";
import {useEmailStore} from "@/store/email.js";
import {defineOptions, onMounted, ref} from "vue";
import router from "@/router/index.js";

defineOptions({
  name: 'star'
})

const scroll = ref({})
const emailStore = useEmailStore();

function jumpContent(email) {
  emailStore.contentData.email = email
  emailStore.contentData.delType = 'logic'
  emailStore.contentData.showStar = true
  emailStore.contentData.showReply = true
  router.push('/message')
}

function cancelStar(email) {
  emailStore.cancelStarEmailId = email.emailId
  scroll.value.deleteEmail([email.emailId])
}

onMounted(() => {
  emailStore.starScroll = scroll
})

</script>

<style scoped>
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
