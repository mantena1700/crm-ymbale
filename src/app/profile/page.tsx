import ProfileClient from './ProfileClient';
import { getProfile } from './actions';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
    const profile = await getProfile();

    return <ProfileClient initialProfile={profile} />;
}

