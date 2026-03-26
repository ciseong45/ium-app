import { getEvents } from "./actions";
import EventsView from "./EventsView";

export default async function EventsPage() {
  const events = await getEvents();
  return <EventsView events={events} />;
}
