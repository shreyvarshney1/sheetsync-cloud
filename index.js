import { Router } from 'itty-router';
import jwt from '@tsndr/cloudflare-worker-jwt';

const router = Router();

async function getJWTAccessToken() {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    const jwtToken = jwt.sign(
        {
            iss: "shreyvarshney@mysite-responses.iam.gserviceaccount.com",
            scope: "https://www.googleapis.com/auth/spreadsheets",
            aud: "https://accounts.google.com/o/oauth2/token",
            exp,
            iat
        },
        {
            "kty": "RSA",
            "n": "mMSDsJrbbsdKOpiFCv7oivf-VMauVZ0G0Jzj_1uxn1XhwK0jYFcQtfLhCRWXwNja2zv3n5NPdU9Xe3s-oQr5Qchwm9uYp5aI7mVb1Bw6y8wGjFUcSDhonhL4yN6Z57HGJVyLTCtsq0XnFLAFMMHYnDlhyE38MVAGaMjcRDmWB_RFoH-j6NeMWogZjfoq6ocY72Jm_1ymS3I23EPt_ZbWKC1vJ4fBPFVbZVu0_3eQk9Z5bbfXUGl0bbriweslglfX3L0pYqPrFXY1OD2lM378VUjdU-wG1NkkhkuAPbRbF02QaTvHzNY4zm1Q-U_KntWEC5y-cOeM0emT7nYFGK1B2Q",
            "e": "AQAB",
            "d": "GDARK76xHJ6YPaPVeNK4bfxq-_BDPRHyOMiGfvF9M52s801WixPt9OkCQWZ2UxXivRCHGfCAhbHsx4PRfD0ZDxXV4o-H4Yz_nENXIUPg-VCR_tkg87xesByP4HoCQ0GN_m9jLMm5WHrmZguinsAqdD3Poh_a3NHvWdrnqTO28gY3-ZeZi2kXVSPvet7QNEbIJovdaljvaqVmGhxaK6gMwj54CXT1ZnHRKdTyCG1PFIJFQ6y6DAI9N1FtOwG5D8Rq-GTxkcy9TTrIswNRPd72OlKfPf0n1hKusikxtFUliBeOIpD_aFracwy5OztOZhy_p84fkpGh4esZiXbxC3P5aQ",
            "p": "x799R5U_XcaxY7bSNaitmrleMJ3cWJZbeI4Psw5Lk-ANxNMt30JWdXk8sYhPNGf-r5QF37kl32-CQ0I6cHcoHxsjYUd41irXD3ZxQ-_ffXkCi5uJujhgpGzvvFlJLMF8q6J4bzUIFPjYH-YiSRUkQHuHMKiWZ7YjJYDhXSC7DZ0",
            "q": "w8oNBwzu2Htbu-06wW7skMroBs9HcUGoPDoJWEflGQyMtG8k4Vy2PS4zOPfL_bwS9JguY_pJb5PvNoAGQ9cnzwn2mGkruHyiuf-fsblyhIP0qyNV-vgDMeISusm3Qf4CYNtcNYOnohdaDE2_ADOS_4fmGhhFY-6qFdhCWl47bm0",
            "dp": "gB6_CI8eWdP8K-0z398Vm0ySsbRPhTLL8QON5leg-nSX4Etj_PPb6PWejHDV_NNHdO8I5XsoY6xubR2pxkFnpqwNgXQKebR4xR4_gEf3nc9kZo-ZQ6ytsEl_a9wJJ3_jq2NGxG3LhUgnuC4wh5fb7NBO4lMARf15hbCo3McFs7E",
            "dq": "SKk5wH4aPhk56DqYbaU_AlVrWuueNfgJ-aAIS80SxwMTTPtakpCXyYjV1bSQ7i_YURIRVWVTz6b1RiKpMJAu4_VsoQ-W_Da1JZYqrAiI6YkXSlQo2qUkemTOUqf97O3Z8Bw40ltz4QINlzdbRTXevhqvWMvdJMM0ODs0FNmX8Nk",
            "qi": "O99epyUGZ0BNFs-Ja6X90t1xbbpH_2qWdtXkt2RBkzvRADgKw9_-Qhz7rCAMegabsbZoNHCZr_eRqR6jIsIKq5Gj7FjqZZlbNPufzH0mLFygTo9cFZOBu58OTFvhpV22kYaWVJj1Dt1S-PMSShweYl0tf_LKdCCu-5rDPOByTX8",
            "ext": true,
            "kid": "38109fa3d970a2138b82eb8ec34030c82a5aef85",
            "alg": "RS256","use":"sig"
          },
        { algorithm: "RS256" }
    );
    return jwtToken;
}

async function getGoogleSheetsAccessToken() {
    const jwtToken = await getJWTAccessToken();
    const response = await fetch(
        "https://accounts.google.com/o/oauth2/token",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: jwtToken,
            }),
        }
    ).then(response => response.json());
    return response.access_token;
}

async function addRow(payload, accessToken) {
    try {
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/1sfvOTrLfy7pR7WJatvzBrryUR1grjT4dEsKsX9mTri0/values/Sheet1!A2:F2:append?valueInputOption=USER_ENTERED`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    range: "Sheet1!A2:F2",
                    majorDimension: "ROWS",
                    values: [
                        [
                            payload.name,
                            payload.email,
                            payload.subject,
                            payload.message,
                            new Date().getDate() +
                            "/" +
                            (new Date().getMonth() + 1) +
                            "/" +
                            new Date().getFullYear(),
                            new Date().getHours() +
                            ":" +
                            new Date().getMinutes() +
                            ":" +
                            new Date().getSeconds(),
                        ],
                    ],
                }),
            }
        );
        if (response.ok) return {
            data: "Success! Your Message has been recorded. I will get back to you soon.",
            status: response.status,
        }
        else return {
            error: response.statusText,
            status: response.status,
        };
    } catch (error) {
        return {
            error: error,
        };
    }
}

router.get('/', () => {
	return Response.redirect('https://shreyvarshney.pages.dev', 302);
});

router.post('/post', async request => {
	const data = await request.json();
    const accessToken = await getGoogleSheetsAccessToken();
    const response = await addRow(data, accessToken);
    if (response === null || typeof response === 'undefined') {
		return new Response('Error adding row to Google Sheets', { status: 500 });
    }
	return new Response(response.data, { status: response.status });
});

export default {
	fetch: router.handle,
};
