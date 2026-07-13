<template>
  <div class="box">
    <div class="title">{{ $t('myMailboxes') }}</div>
    <div class="subtitle">{{ $t('sharedWithMe') }}</div>
    <el-table :data="rows" v-loading="loading" class="table" :empty-text="loading ? '' : '—'">
      <el-table-column :label="'Email'" :min-width="220">
        <template #default="props">
          <span class="email-cell">{{ props.row.email }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="$t('rename')" :width="120">
        <template #default="props">
          <span>{{ props.row.name || '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="$t('mailboxRole')" :width="120">
        <template #default="props">
          <el-tag v-if="props.row.perm === 'owner'" type="primary" disable-transitions>
            {{ $t('mailboxOwner') }}
          </el-tag>
          <el-tag v-else-if="props.row.perm === 'admin'" disable-transitions>
            {{ $t('roleAdmin') }}
          </el-tag>
          <el-tag v-else-if="props.row.perm === 'sender'" type="info" disable-transitions>
            {{ $t('roleSender') }}
          </el-tag>
          <el-tag v-else-if="props.row.perm === 'viewer'" type="info" disable-transitions>
            {{ $t('roleViewer') }}
          </el-tag>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column :label="$t('mailboxOwner')" :min-width="200">
        <template #default="props">
          <span class="email-cell" style="color: var(--regular-text-color);">
            {{ props.row.ownerEmail || '—' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column :label="$t('memberCount')" :width="90" align="right">
        <template #default="props">
          <span class="num">
            {{ props.row.perm === 'owner' ? (props.row.memberCount ?? 0) : '—' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column :label="$t('action')" :width="120" align="right">
        <template #default="props">
          <div class="row-actions">
            <Icon
                icon="ion:swap-horizontal"
                width="18"
                height="18"
                class="row-icon"
                @click="switchTo(props.row)"
            />
            <Icon
                v-if="canManage(props.row)"
                icon="ion:people-outline"
                width="18"
                height="18"
                class="row-icon"
                @click="openMember(props.row)"
            />
            <Icon
                v-if="canManage(props.row)"
                icon="ion:create-outline"
                width="18"
                height="18"
                class="row-icon"
                @click="renameMailbox(props.row)"
            />
            <Icon
                v-if="props.row.perm === 'owner' && props.row.accountId !== selfAccountId && hasPerm('account:delete')"
                icon="ion:trash-outline"
                width="18"
                height="18"
                class="row-icon row-icon-danger"
                @click="deleteMailbox(props.row)"
            />
          </div>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="renameShow" :title="$t('rename')" width="420">
      <el-input v-model="renameValue" :maxlength="30"/>
      <template #footer>
        <el-button @click="renameShow = false">{{ $t('cancel') }}</el-button>
        <el-button type="primary" @click="submitRename">{{ $t('confirm') }}</el-button>
      </template>
    </el-dialog>

    <AccountMemberDialog
        v-if="memberTarget"
        :open="!!memberTarget"
        :account-id="memberTarget.accountId"
        :account-email="memberTarget.email"
        :can-manage="canManage(memberTarget)"
        @close="memberTarget = null"
    />
  </div>
</template>

<script setup>
import {defineOptions, ref, onMounted, computed} from 'vue'
import {Icon} from '@iconify/vue'
import {useI18n} from 'vue-i18n'
import {
  accountDelete,
  accountList,
  accountSetName,
} from '@/request/account.js'
import {useAccountStore} from '@/store/account.js'
import {useUserStore} from '@/store/user.js'
import {hasPerm} from '@/perm/perm.js'
import AccountMemberDialog from '@/components/account-member-dialog.vue'

defineOptions({name: 'myMailbox'})

const {t} = useI18n()
const accountStore = useAccountStore()
const userStore = useUserStore()

const rows = ref([])
const loading = ref(false)

const memberTarget = ref(null)
const renameShow = ref(false)
const renameTarget = ref(null)
const renameValue = ref('')

const selfAccountId = computed(() => userStore.user?.account?.accountId)

const canManage = (item) => item.perm === 'owner' || item.perm === 'admin'

async function refresh() {
  loading.value = true
  try {
    const list = await accountList(0, 30)
    rows.value = list || []
  } catch (e) {
    rows.value = []
  } finally {
    loading.value = false
  }
}

onMounted(refresh)

function switchTo(item) {
  accountStore.currentAccountId = item.accountId
  accountStore.currentAccount = item
}

function openMember(item) {
  memberTarget.value = item
}

function renameMailbox(item) {
  renameTarget.value = item
  renameValue.value = item.name ?? ''
  renameShow.value = true
}

async function submitRename() {
  if (!renameTarget.value) return
  await accountSetName(renameTarget.value.accountId, renameValue.value)
  ElMessage({message: t('setSuccess'), type: 'success', plain: true})
  renameShow.value = false
  refresh()
}

function deleteMailbox(item) {
  ElMessageBox.confirm(t('delConfirm', {msg: item.email}), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning',
  }).then(async () => {
    await accountDelete(item.accountId)
    ElMessage({message: t('delSuccessMsg'), type: 'success', plain: true})
    refresh()
  })
}
</script>

<style scoped lang="scss">
.box {
  padding: 30px 40px;

  .title {
    font-size: 18px;
    font-weight: bold;
  }

  .subtitle {
    color: var(--regular-text-color);
    font-size: 12px;
    margin-top: 4px;
    margin-bottom: 18px;
  }

  .table {
    width: 100%;

    .email-cell {
      font-family: var(--el-font-family-monospace, monospace);
    }

    .num {
      font-family: var(--el-font-family-monospace, monospace);
    }

    :deep(.cell) {
      word-break: break-all;
    }
  }

  .row-actions {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .row-icon {
    cursor: pointer;
    color: var(--regular-text-color);
    transition: color 200ms;

    &:hover {
      color: var(--el-color-primary);
    }
  }

  .row-icon-danger:hover {
    color: var(--el-color-danger);
  }
}
</style>
