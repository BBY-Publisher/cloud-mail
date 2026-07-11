import http from '@/axios/index.js';

export function webhookEventList(params) {
	return http.get('/webhookEvent/list', { params });
}

export function webhookEventClear() {
	return http.delete('/webhookEvent/clear');
}

export function allEmailGet(id) {
	return http.get('/allEmail/get', { params: { id }, noMsg: true });
}