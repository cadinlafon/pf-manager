import { buildEmbedUrl, DEFAULT_DISPLAY, SIZES } from "../../lib/googleCalendar";

// The embedded Google Calendar. Google's embed is always light, so it sits on
// a white panel in both themes.
export default function CalendarFrame({ config, display = DEFAULT_DISPLAY, height }) {
  const frameHeight = height || SIZES.find((size) => size.value === display.size)?.height || 640;
  return (
    <div className="calendar-frame" style={{ height: frameHeight }}>
      <iframe
        key={buildEmbedUrl(config, display)}
        src={buildEmbedUrl(config, display)}
        title="Google Calendar"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
