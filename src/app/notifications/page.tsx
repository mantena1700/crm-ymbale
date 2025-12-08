import NotificationsClient from './NotificationsClient';
import { getNotifications } from './actions';

export default async function NotificationsPage() {
    const notifications = await getNotifications();

    return <NotificationsClient initialNotifications={notifications} />;
}
