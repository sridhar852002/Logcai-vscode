//  src/utils/eventBus.ts
import { EventEmitter } from 'events';

class EventBus extends EventEmitter {}
const eventBus = new EventBus();
export default eventBus;
