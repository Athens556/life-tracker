import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// The ONE writer for folder attributes (type, and the System links/cadence of a
// complementary folder). Created on first write; no doc means a mandatory folder.
export const folderDocId = (uid, name) => `${uid}__${encodeURIComponent(name)}`;

export function saveFolder(uid, name, data) {
    return setDoc(doc(db, 'habitFolders', folderDocId(uid, name)), { userId: uid, name, ...data }, { merge: true })
        .catch(console.error);
}
