// Receives the contact form (it used to post to Framer's form service) and
// forwards it to Formspree, which emails it to Erin.
const HONEYPOTS = ["website", "company", "message", "subject", "title", "description",
  "feedback", "notes", "details", "remarks", "comments"];

function reply(status, message) {
  const body = status < 300 ? { ok: true } : { error: { message } };
  return Response.json(body, { status });
}

export async function handleContact(request, env) {
  if (request.method !== "POST") return reply(405, "Method not allowed");
  if (!env.CONTACT_FORWARD_URL) return reply(503, "Contact form is not set up yet");

  let form;
  try {
    form = await request.formData();
  } catch {
    return reply(400, "Could not read the form");
  }
  // Framer's hidden spam traps: people never fill them in, bots often do.
  // Pretend it worked so bots don't learn anything.
  if (HONEYPOTS.some((name) => (form.get(name) || "").toString().trim())) return reply(200);

  const name = (form.get("Name") || "").toString().trim();
  const email = (form.get("Email") || "").toString().trim();
  const message = (form.get("Message") || "").toString().trim();
  if (!name || !email || !message) return reply(400, "Please fill in every field");

  const res = await fetch(env.CONTACT_FORWARD_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ name, email, message, _replyto: email, _subject: `freeformed.com: message from ${name}` }),
  });
  if (!res.ok) return reply(502, "Could not send your message, please email erin@freeformed.com");
  return reply(200);
}
