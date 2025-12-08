import ProfileClient from './ProfileClient';
import { getProfile } from './actions';

export default async function ProfilePage() {
    const profile = await getProfile();

    return <ProfileClient initialProfile={profile} />;
}

