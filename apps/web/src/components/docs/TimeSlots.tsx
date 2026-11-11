import { useSyncExternalStore } from "react";

// One week of slots, in rotation order. Only the weekday and time are shown.
const SLOTS = [
  { name: "A", time: 1794700800 },
  { name: "B", time: 1794663000 },
  { name: "C", time: 1794637800 },
  { name: "D", time: 1794675600 },
  { name: "E", time: 1794650400 },
  { name: "F", time: 1794688200 },
];

export default function TimeSlots() {
  // The static HTML shows UTC, then the browser switches to the reader's zone.
  const timeZone = useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC"
  );

  const format = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  });

  return (
    <table>
      <thead>
        <tr>
          <th>Slot</th>
          <th>Day & time ({timeZone.replaceAll("_", " ")})</th>
        </tr>
      </thead>
      <tbody>
        {SLOTS.map((slot) => (
          <tr key={slot.name}>
            <td>{slot.name}</td>
            <td>{format.format(slot.time * 1000)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
