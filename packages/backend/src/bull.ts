import { Queue, Worker } from 'bullmq';
import { env } from './env';
import { redis } from './redis';
import { cancelRoomIfEmpty, settleRoom } from './services/roomService';

const connection = redis.duplicate();

export const roomQueue = new Queue('room', {
  connection,
  prefix: env.bullPrefix,
});

export function startWorkers() {
  // Cancel room worker
  new Worker('room', async (job) => {
    const { name, data } = job;
    if (name === 'cancel_if_empty') {
      await cancelRoomIfEmpty(data.roomId);
    }
    if (name === 'settle_room') {
      await settleRoom(data.roomId);
    }
  }, { connection, prefix: env.bullPrefix });
}
