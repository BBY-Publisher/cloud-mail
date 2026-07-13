<template>
  <el-dialog
      :model-value="open"
      :title="t('memberManagement') + ' · ' + accountEmail"
      width="640px"
      @close="onClose"
      @closed="resetForm"
  >
    <div class="member-add-row" v-if="canManage">
      <el-input
          v-model="addEmail"
          :placeholder="t('memberEmail')"
          class="member-email-input"
      />
      <el-select v-model="addRole" class="member-role-select">
        <el-option :key="'viewer'" :label="t('roleViewer')" :value="'viewer'"/>
        <el-option :key="'sender'" :label="t('roleSender')" :value="'sender'"/>
        <el-option :key="'admin'" :label="t('roleAdmin')" :value="'admin'"/>
      </el-select>
      <el-button type="primary" :loading="adding" @click="submitAdd">{{ t('addMember') }}</el-button>
    </div>
    <el-table :data="members" v-loading="loading" class="member-table" max-height="400">
      <el-table-column :label="t('memberEmail')" prop="email">
        <template #default="props">
          <span class="member-email-cell">{{ props.row.email }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('memberRole')" :width="locale === 'en' ? 180 : 150">
        <template #default="props">
          <el-select
              v-if="canManage"
              :model-value="props.row.role || 'viewer'"
              class="member-role-edit"
              @change="(v) => changeRole(props.row, v)"
          >
            <el-option :key="'viewer'" :label="t('roleViewer')" :value="'viewer'"/>
            <el-option :key="'sender'" :label="t('roleSender')" :value="'sender'"/>
            <el-option :key="'admin'" :label="t('roleAdmin')" :value="'admin'"/>
          </el-select>
          <el-tag v-else type="info" disable-transitions>{{ roleLabel(props.row.role) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :width="locale === 'en' ? 70 : 60" align="right">
        <template #default="props">
          <Icon
              icon="ion:trash-outline"
              width="18"
              height="18"
              :class="['member-remove', !canManage && 'disabled']"
              @click="canManage && askRemove(props.row)"
          />
        </template>
      </el-table-column>
      <template #empty>
        <span class="member-empty">—</span>
      </template>
    </el-table>
    <template #footer>
      <el-button @click="onClose">{{ t('cancel') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import {computed, ref, watch} from 'vue'
import {Icon} from '@iconify/vue'
import {useI18n} from 'vue-i18n'
import {
  accountMemberAdd,
  accountMemberList,
  accountMemberRemove,
  accountMemberSetRole,
} from '@/request/account.js'

const props = defineProps({
  open: {type: Boolean, default: false},
  accountId: {type: Number, required: true},
  accountEmail: {type: String, default: ''},
  canManage: {type: Boolean, default: false},
})

const emit = defineEmits(['close'])

const {t, locale} = useI18n()

const members = ref([])
const loading = ref(false)
const addEmail = ref('')
const addRole = ref('sender')
const adding = ref(false)

const roleLabel = (role) => {
  if (role === 'sender') return t('roleSender')
  if (role === 'admin') return t('roleAdmin')
  return t('roleViewer')
}

async function refresh() {
  if (!props.open) return
  loading.value = true
  try {
    const list = await accountMemberList(props.accountId)
    members.value = list || []
  } catch (e) {
    members.value = []
  } finally {
    loading.value = false
  }
}

watch(() => props.open, (val) => {
  if (val) refresh()
})

async function submitAdd() {
  if (!addEmail.value) return
  adding.value = true
  try {
    await accountMemberAdd(props.accountId, addEmail.value, addRole.value)
    addEmail.value = ''
    ElMessage({message: t('setSuccess'), type: 'success', plain: true})
    refresh()
  } finally {
    adding.value = false
  }
}

async function changeRole(member, role) {
  try {
    await accountMemberSetRole(props.accountId, member.userId, role)
    ElMessage({message: t('setSuccess'), type: 'success', plain: true})
    refresh()
  } catch (e) {}
}

function askRemove(member) {
  ElMessageBox.confirm(
      t('removeMember') + ' · ' + member.email,
      {confirmButtonText: t('confirm'), cancelButtonText: t('cancel'), type: 'warning'},
  ).then(async () => {
    try {
      await accountMemberRemove(props.accountId, member.userId)
      ElMessage({message: t('setSuccess'), type: 'success', plain: true})
      refresh()
    } catch (e) {}
  })
}

function resetForm() {
  members.value = []
  addEmail.value = ''
  addRole.value = 'sender'
}

function onClose() {
  emit('close')
}
</script>

<style scoped>
.member-add-row {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.member-email-input {
  flex: 1;
}

.member-role-select {
  width: 130px;
}

.member-email-cell {
  font-family: var(--el-font-family-monospace, monospace);
}

.member-role-edit {
  width: 120px;
}

.member-remove {
  cursor: pointer;
  color: var(--regular-text-color);
  transition: color 200ms;
}

.member-remove:hover {
  color: var(--el-color-danger);
}

.member-remove.disabled {
  cursor: not-allowed;
  opacity: 0.3;
}

.member-empty {
  display: inline-block;
  color: var(--regular-text-color);
}

.member-table :deep(.cell) {
  word-break: break-all;
}
</style>
