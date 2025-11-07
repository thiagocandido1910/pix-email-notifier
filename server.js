const express = require('express');
const axios = require('axios');
const sgMail = require('@sendgrid/mail');

const app = express();
app.use(express.json());

const {
  MP_ACCESS_TOKEN,
  SENDGRID_API_KEY,
  MAIL_TO
} = process.env;

sgMail.setApiKey(SENDGRID_API_KEY);

app.get('/', (req, res) => {
  res.send('Servidor de Webhook do Pix com SendGrid está rodando.');
});

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    res.sendStatus(200);

    if (!body || body.type !== 'payment') return;
    const paymentId = body?.data?.id;
    if (!paymentId) return;

    const mp = axios.create({
      baseURL: 'https://api.mercadopago.com',
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` }
    });

    const { data: payment } = await mp.get(`/v1/payments/${paymentId}`);

    const isPix = payment.payment_method_id === 'pix';
    const isApproved = payment.status === 'approved';
    if (!isPix || !isApproved) return;

    const valor = payment.transaction_amount;
    const payer = payment.payer || {};
    const fullName = `${payer.first_name || ''} ${payer.last_name || ''}`.trim() || 'Pagador não identificado';

    const subject = `Pix recebido: ${fullName} — R$ ${valor.toFixed(2)}`;
    const html = `
      <h3>✅ Pix recebido</h3>
      <p><b>Pagador:</b> ${fullName}</p>
      <p><b>Valor:</b> R$ ${valor.toFixed(2)}</p>
      <p><b>Status:</b> ${payment.status}</p>
      <p><b>ID do pagamento:</b> ${paymentId}</p>
      <hr/>
      <small>Notificador automático via SendGrid.</small>
    `;

    await sgMail.send({
      to: MAIL_TO,
      from: MAIL_TO,
      subject,
      html
    });

    console.log(`E-mail enviado via SendGrid: ${subject}`);
  } catch (err) {
    console.error('Erro no webhook:', err?.response?.data || err.message);
  }
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});