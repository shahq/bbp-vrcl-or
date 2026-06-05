import { CardData } from './types';
import { CANVAS_COLUMNS } from './config/canvasSections';

export const COLUMNS = CANVAS_COLUMNS;

export const INITIAL_CARDS: CardData[] = [
  { id: 'c1', section: 'place', content: "They're at the start of their new venture", starred: false },
  { id: 'c2', section: 'place', content: "You are at a crossroads in their business", starred: true },
  { id: 'c3', section: 'place', content: "They are about to expand", starred: false },
  
  { id: 'c4', section: 'role', content: "To create cheaper energy sources for everyone", starred: false },
  { id: 'c5', section: 'role', content: "To Build Sustainable Communities", starred: false },
  { id: 'c6', section: 'role', content: "To enable your people with access to a clean grid", starred: true },
  
  { id: 'c9', section: 'point_a', content: "Where you are at right now", starred: false },
  { id: 'c10', section: 'point_b', content: "Where you need to be", starred: false },
  
  { id: 'c11', section: 'change', content: "The transformation that needs to happen to get from A to B", starred: false },
];
