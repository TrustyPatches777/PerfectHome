import { create } from 'zustand';
import type { Point } from '../model';

/** Someone else in the live session (from the shared awareness state). */
export interface Peer {
  /** Yjs client id: unique per open tab. */
  id: number;
  name: string;
  color: string;
  /** Floor they are looking at. */
  floor: string | null;
  /** Where their mouse is on the plan, in meters. */
  cursor: Point | null;
}

interface LiveStore {
  active: boolean;
  /** `room.key` of the session (the part after `#live=`). */
  id: string | null;
  /** The shared design has arrived (a new room is empty until somebody who has the design is online). */
  synced: boolean;
  peers: Peer[];
}

export const useLive = create<LiveStore>(() => ({ active: false, id: null, synced: false, peers: [] }));
