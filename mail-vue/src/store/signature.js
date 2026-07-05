import { defineStore } from 'pinia'

export const useSignatureStore = defineStore('signature', {
    state: () => ({
        refresh: 0,
    }),
    actions: {
        refreshSignature() {
            this.refresh ++
        }
    },
})
