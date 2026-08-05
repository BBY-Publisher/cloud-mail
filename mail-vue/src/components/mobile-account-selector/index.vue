<template>
  <div class="mobile-account-selector" v-if="canShow">
    <el-dropdown
      trigger="click"
      :hide-on-click="false"
      @visible-change="onVisibleChange"
    >
      <button class="trigger" type="button" :aria-label="t('switchMailbox')">
        <span class="avatar">{{ avatarLetter }}</span>
        <span class="info">
          <span class="name">{{ displayName }}</span>
          <span class="email">{{ displayEmail }}</span>
        </span>
        <Icon icon="mingcute:down-small-fill" width="18" height="18" class="caret" :class="{ open }" />
      </button>
      <template #dropdown>
        <el-dropdown-menu class="account-menu" style="width: 100%;">
          <div class="menu-header">{{ t('switchMailbox') }}</div>
          <div v-if="loading && accounts.length === 0" class="menu-status">
            {{ t('loadMailboxesFailed') }}
          </div>
          <div v-else-if="others.length === 0" class="menu-status">
            {{ t('noOtherMailboxes') }}
          </div>
          <el-dropdown-item
            v-for="item in others"
            :key="item.accountId"
            class="account-item"
            @click="switchTo(item)"
          >
            <div class="item-row">
              <span class="item-name">{{ item.name || item.email }}</span>
              <el-tag
                v-if="item.perm && item.perm !== 'owner'"
                :type="roleTagType(item.perm)"
                size="small"
                disable-transitions
                class="role-tag"
              >{{ permLabel(item.perm) }}</el-tag>
            </div>
            <span class="item-email">{{ item.email }}</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useAccountStore } from '@/store/account.js'
import { useUiStore } from '@/store/ui.js'
import { useSettingStore } from '@/store/setting.js'
import { accountList } from '@/request/account.js'
import { hasPerm } from '@/perm/perm.js'

const { t } = useI18n()
const accountStore = useAccountStore()
const uiStore = useUiStore()
const settingStore = useSettingStore()

const accounts = ref([])
const loading = ref(false)
const open = ref(false)

const accountBoxVisible = computed(
  () => uiStore.accountShow && settingStore.settings.manyEmail === 0 && hasPerm('account:query')
)
const canShow = computed(() => !accountBoxVisible.value)

const currentEmail = computed(() => accountStore.currentAccount?.email || '')
const currentName = computed(() => accountStore.currentAccount?.name || '')
const avatarLetter = computed(() => (currentEmail.value[0] || '?').toUpperCase())
const displayName = computed(() => currentName.value || currentEmail.value || '—')
const displayEmail = computed(() => currentEmail.value || t('switchMailboxHint'))
const others = computed(() =>
  accounts.value.filter((a) => a.accountId !== accountStore.currentAccountId)
)

function permLabel(perm) {
  if (perm === 'admin') return t('roleAdmin')
  if (perm === 'sender') return t('roleSender')
  if (perm === 'viewer') return t('roleViewer')
  return ''
}

function roleTagType(perm) {
  if (perm === 'admin') return ''
  return 'info'
}

function switchTo(item) {
  if (item.accountId === accountStore.currentAccountId) {
    open.value = false
    return
  }
  accountStore.currentAccountId = item.accountId
  accountStore.currentAccount = {
    accountId: item.accountId,
    email: item.email,
    name: item.name,
    allReceive: item.allReceive,
  }
  open.value = false
}

async function refresh() {
  loading.value = true
  try {
    const list = await accountList(0, 50)
    accounts.value = list || []
  } catch {
    ElMessage({ message: t('loadMailboxesFailed'), type: 'error', plain: true })
  } finally {
    loading.value = false
  }
}

function onVisibleChange(visible) {
  open.value = visible
  if (visible && hasPerm('account:query')) {
    refresh()
  }
}
</script>

<style scoped lang="scss">
.mobile-account-selector {
  display: none;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  @media (max-width: 1024px) {
    display: block;
  }
}

.trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: transparent;
  border: 0;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;

  &:hover,
  &:active {
    background: var(--el-fill-color-light);
  }
}

.avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--el-text-color-primary);
  color: var(--el-bg-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.email {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.caret {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  transition: transform 200ms;

  &.open {
    transform: rotate(180deg);
  }
}

.account-menu {
  width: 100%;
  max-height: 70vh;
  overflow: auto;
  padding: 0;
}

:deep(.el-popper) {
  width: 100%;
  max-width: 100vw;
}

:deep(.el-popper .el-dropdown-menu) {
  width: 100%;
}

.menu-header {
  padding: 10px 12px 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.menu-status {
  padding: 18px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

:deep(.account-item) {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  line-height: 1.3;

  &:hover,
  &:focus {
    background: var(--el-fill-color-light);
  }
}

.item-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
}

.item-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.role-tag {
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 10px;
  height: 16px;
  line-height: 16px;
  padding: 0 5px;
}

.item-email {
  width: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
