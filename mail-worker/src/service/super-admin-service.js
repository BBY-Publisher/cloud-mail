import BizError from '../error/biz-error';
import { t } from '../i18n/i18n';
import userContext from '../security/user-context';
import settingService from './setting-service';

const superAdminService = {

	async require(c) {
		const user = userContext.getUser(c);
		const setting = await settingService.query(c);

		if (!settingService.isAdmin(setting, user?.email)) {
			throw new BizError(t('unauthorized'), 403);
		}

		return user;
	}
};

export default superAdminService;
