// src/pages/api/contato.ts
export const prerender = false;

import type { APIRoute } from "astro";

const ALLOWED_SERVICOS = [
  "Integração de sistemas",
  "Automação de processos",
  "Desenvolvimento de sites",
  "Outro",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONE_REGEX =
  /^(\+?55)?[\s.-]?\(?(\d{2})\)?[\s.-]?(\d{4,5})[\s.-]?(\d{4})$/;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.formData();

    const nomeRaw = (data.get("nome") ?? "").toString().trim();
    const emailRaw = (data.get("email") ?? "").toString().trim();
    const telefoneRaw = (data.get("telefone") ?? "").toString().trim();
    const telefoneFormatado = telefoneRaw
      ? "+55" + telefoneRaw.replace(/\D/g, "")
      : null;
    const servicoRaw = (data.get("servico") ?? "").toString().trim();
    const mensagemRaw = (data.get("mensagem") ?? "").toString().trim();

    // Server-side validation
    if (!nomeRaw) return badRequest("O nome é obrigatório.");
    if (nomeRaw.length > 100)
      return badRequest("O nome deve ter no máximo 100 caracteres.");

    if (!emailRaw) return badRequest("O e-mail é obrigatório.");
    if (!EMAIL_REGEX.test(emailRaw))
      return badRequest("Informe um e-mail válido.");

    if (telefoneRaw && !TELEFONE_REGEX.test(telefoneRaw)) {
      return badRequest("Informe um telefone válido com DDD.");
    }

    if (!servicoRaw || !ALLOWED_SERVICOS.includes(servicoRaw)) {
      return badRequest("Selecione um serviço de interesse válido.");
    }

    if (!mensagemRaw) return badRequest("A mensagem é obrigatória.");
    if (mensagemRaw.length > 2000)
      return badRequest("A mensagem deve ter no máximo 2000 caracteres.");

    const apiKey = import.meta.env.BREVO_API_KEY;
    if (!apiKey) {
      console.error("BREVO_API_KEY não configurado.");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Configuração do servidor incorreta.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const nome = escapeHtml(nomeRaw);
    const email = escapeHtml(emailRaw);
    const telefone = telefoneRaw ? escapeHtml(telefoneRaw) : "Não informado";
    const servico = escapeHtml(servicoRaw);
    const mensagem = escapeHtml(mensagemRaw).replace(/\n/g, "<br>");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let res: Response;
    try {
      res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: nomeRaw, email: "pedro@cordeirolima.net" },
          to: [
            { email: "pedro@cordeirolima.net", name: "Pedro Cordeiro Lima" },
          ],
          replyTo: { email: emailRaw, name: nomeRaw },
          subject: `Novo contato: ${servicoRaw} — ${nomeRaw}`,
          htmlContent: `
            <h2>Novo contato pelo site</h2>
            <p><strong>Nome:</strong> ${nome}</p>
            <p><strong>E-mail:</strong> ${email}</p>
            <p><strong>Telefone:</strong> ${telefone}</p>
            <p><strong>Serviço:</strong> ${servico}</p>
            <p><strong>Mensagem:</strong><br>${mensagem}</p>
          `,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (res.ok) {
      // Confirmation email to client — failure is non-blocking
      try {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: [{ email: emailRaw, name: nomeRaw }],
            replyTo: {
              email: "pedro@cordeirolima.net",
              name: "Pedro Cordeiro Lima",
            },
            sender: {
              name: "Pedro Cordeiro Lima",
              email: "pedro@cordeirolima.net",
            },
            templateId: 3,
            params: {
              nome: nomeRaw,
              servico: servicoRaw,
            },
          }),
        });
      } catch (confirmErr) {
        console.error("Confirmation email failed (non-blocking):", confirmErr);
      }

      // Create/update CRM contact — failure is non-blocking
      try {
        await fetch("https://api.brevo.com/v3/contacts", {
          method: "POST",
          headers: {
            "api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: emailRaw,
            updateEnabled: true,
            attributes: {
              FIRSTNAME: nomeRaw,
              ...(telefoneFormatado ? { SMS: telefoneFormatado } : {}),
            },
            listIds: [7],
          }),
        });
      } catch (crmErr) {
        console.error("CRM contact upsert failed:", JSON.stringify(crmErr));
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      const errorText = await res.text();
      console.error("Brevo API Error:", errorText);
      return new Response(JSON.stringify({ success: false }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("Brevo API timeout");
      return new Response(
        JSON.stringify({ success: false, error: "Timeout ao enviar e-mail." }),
        {
          status: 504,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    console.error("Internal Server Error in contato API:", error);
    return new Response(JSON.stringify({ success: false }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
