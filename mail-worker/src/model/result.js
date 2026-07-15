const result = {
	ok(data) {
		return { code: 200, message: 'success', data: data ? data : null };
	},
	fail(message, code = 500, data = null) {
		return { code, message, data };
	}
};
export default result;
