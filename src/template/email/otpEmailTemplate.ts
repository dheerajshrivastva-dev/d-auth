import AuthConfig from "../../config/authConfig";
import { footerTemplate } from "./footerTemplate";

const otpEmailTemplateMessage = `
    <!-- Content -->
    <div class="content">
        <p>Hi <strong>{{userName}}</strong>,</p>

        <p>You recently requested to reset your password for your <strong>{{companyName}}</strong> account. Use the OTP below to complete the process. If you did not request this, you can safely ignore this email.</p>

        <!-- OTP -->
        <div class="otp">{{OTP}}</div>

        <p>This OTP is valid for the next <strong>{{validityMinutes}} minutes</strong>. Please do not share it with anyone.</p>

        <p>Thanks for being a part of <strong>{{companyName}}</strong>!</p>
    </div>`;

const otpNewTemplate = `
<!DOCTYPE html>

<html lang="en" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:v="urn:schemas-microsoft-com:vml">

<head>
	<title></title>
	<meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
	<meta content="width=device-width, initial-scale=1.0" name="viewport" />
	<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]--><!--[if !mso]><!-->
	<link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@100;200;300;400;500;600;700;800;900" rel="stylesheet"
		type="text/css" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet"
		type="text/css" /><!--<![endif]-->
	<style>
		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			padding: 0;
		}

		a[x-apple-data-detectors] {
			color: inherit !important;
			text-decoration: inherit !important;
		}

		#MessageViewBody a {
			color: inherit;
			text-decoration: none;
		}

		p {
			line-height: inherit
		}

		.desktop_hide,
		.desktop_hide table {
			mso-hide: all;
			display: none;
			max-height: 0px;
			overflow: hidden;
		}

		.image_block img+div {
			display: none;
		}

		sup,
		sub {
			font-size: 75%;
			line-height: 0;
		}

		.image-card {
			position: relative;
		}

		@media (max-width:620px) {
			.desktop_hide table.icons-inner {
				display: inline-block !important;
			}

			.icons-inner {
				text-align: center;
			}

			.icons-inner td {
				margin: 0 auto;
			}

			.mobile_hide {
				display: none;
			}

			.row-content {
				width: 100% !important;
			}

			.stack .column {
				width: 100%;
				display: block;
			}

			.mobile_hide {
				min-height: 0;
				max-height: 0;
				max-width: 0;
				overflow: hidden;
				font-size: 0px;
			}

			.desktop_hide,
			.desktop_hide table {
				display: table !important;
				max-height: none !important;
			}
		}

	</style>
	<!--[if mso ]><style>sup, sub { font-size: 100% !important; } sup { mso-text-raise:10% } sub { mso-text-raise:-10% }</style> <![endif]-->
</head>

<body class="body"
	style="background-color: #ffffff; margin: 0; padding: 0; -webkit-text-size-adjust: none; text-size-adjust: none;">
	<table border="0" cellpadding="0" cellspacing="0" class="nl-container" role="presentation"
		style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #ffffff;" width="100%">
		<tbody>
			<tr>
				<td>
					<table align="center" border="0" cellpadding="0" cellspacing="0" class="row row-1" role="presentation"
						style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
						<tbody>
							<tr>
								<td>
									<table align="center" border="0" cellpadding="0" cellspacing="0" class="row-content stack"
										role="presentation"
										style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; color: #000000; width: 600px; margin: 0 auto;"
										width="600">
										<tbody>
											<tr>
												<td class="column column-1"
													style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top; border-radius: 0px 0px 0px 0px; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;"
													width="100%">
													<table border="0" cellpadding="0" cellspacing="0" class="image_block block-1"
														role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
														<tr>
															<td class="pad" style="width:100%;">
																<div align="center" class="alignment image-card" style="line-height:10px">
																	<div style="max-width: 600px;"><img alt="" height="auto"
																			src="https://github.com/user-attachments/assets/e971a17d-b91a-47b9-ac91-7e2577c02db0"
																			style="display: block; height: auto; border: 0; width: 100%; border-radius: 30px 30px 0px 0px;"
																			title="" width="600" /></div>
																</div>
																<div class="card">
																	<table border="0" cellpadding="20" cellspacing="0" class="paragraph_block block-2"
																		role="presentation"
																		style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;" width="100%">
																		<tr>
																			<td class="pad">
																				<div
																					style="color:#101112;direction:ltr;font-family:'Ubuntu', Tahoma, Verdana, Segoe, sans-serif;font-size:16px;font-weight:400;letter-spacing:0px;line-height:180%;text-align:left;mso-line-height-alt:28.8px;">
																					<p style="margin: 0; margin-bottom: 16px;">Hi {{userName}},</p>
																					<p style="margin: 0;">You recently requested to reset your password for your
																						<strong>{{companyName}} account. </strong>Use the OTP below to complete the process.</p>
																				</div>
																			</td>
																		</tr>
																	</table>
																	<div class="spacer_block block-3" style="height:30px;line-height:30px;font-size:1px;"> </div>
																	<table border="0" cellpadding="10" cellspacing="0" class="heading_block block-4"
																		role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
																		<tr>
																			<td class="pad">
																				<h3
																					style="margin: 0; color: #9881ff; direction: ltr; font-family: 'Ubuntu', Tahoma, Verdana, Segoe, sans-serif; font-size: 24px; font-weight: 700; letter-spacing: normal; line-height: 120%; text-align: center; margin-top: 0; margin-bottom: 0; mso-line-height-alt: 28.799999999999997px;">
																					<span class="tinyMce-placeholder" style="word-break: break-word;">Your OTP:
																						<strong>{{OTP}}</strong></span></h3>
																			</td>
																		</tr>
																	</table>
																	<div class="spacer_block block-5" style="height:30px;line-height:30px;font-size:1px;"> </div>
																	<table border="0" cellpadding="0" cellspacing="0" class="paragraph_block block-6"
																		role="presentation"
																		style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;" width="100%">
																		<tr>
																			<td class="pad"
																				style="padding-bottom:10px;padding-left:20px;padding-right:20px;padding-top:10px;">
																				<div
																					style="color:#101112;direction:ltr;font-family:'Ubuntu', Tahoma, Verdana, Segoe, sans-serif;font-size:16px;font-weight:400;letter-spacing:0px;line-height:180%;text-align:left;mso-line-height-alt:28.8px;">
																					<p style="margin: 0;">This OTP is valid for the next <strong>{{validityMinutes}} minutes</strong>.
																						Please do not share it with anyone.</p>
																				</div>
																			</td>
																		</tr>
																	</table>
																	<table border="0" cellpadding="10" cellspacing="0" class="divider_block block-7"
																		role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
																		<tr>
																			<td class="pad">
																				<div align="center" class="alignment">
																					<table border="0" cellpadding="0" cellspacing="0" role="presentation"
																						style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
																						<tr>
																							<td class="divider_inner"
																								style="font-size: 1px; line-height: 1px; border-top: 1px solid #dddddd;"><span
																									style="word-break: break-word;"> </span></td>
																						</tr>
																					</table>
																				</div>
																			</td>
																		</tr>
																	</table>
																	<table border="0" cellpadding="0" cellspacing="0" class="paragraph_block block-8"
																		role="presentation"
																		style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;" width="100%">
																		<tr>
																			<td class="pad"
																				style="padding-bottom:10px;padding-left:20px;padding-right:20px;padding-top:10px;">
																				<div
																					style="color:#616971;direction:ltr;font-family:'Ubuntu', Tahoma, Verdana, Segoe, sans-serif;font-size:16px;font-weight:400;letter-spacing:0px;line-height:120%;text-align:center;mso-line-height-alt:19.2px;">
																					<p style="margin: 0;">If you didn’t request this email, please <a
																							href="{{reportLink}}" rel="noopener"
																							style="text-decoration: underline; color: #7747FF;" target="_blank">report</a> it
																						here.</p>
																				</div>
																			</td>
																		</tr>
																	</table>
																</div>
															</td>
														</tr>
													</table>
													
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table align="center" border="0" cellpadding="0" cellspacing="0" class="row row-2 footer" role="presentation"
						style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; " width="100%">
						<tbody>
							<tr>
								<td>
									<table align="center" border="0" cellpadding="0" cellspacing="0" class="row-content stack"
										role="presentation"
										style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-radius: 0; color: #000000; width: 600px; margin: 0 auto;"
										width="600">
										<tbody>
											<tr>
												<td class="column column-1"
													style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 30px; padding-left: 20px; padding-right: 20px; padding-top: 10px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;"
													width="100%">
													<table border="0" cellpadding="0" cellspacing="0" class="image_block block-1"
														role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
														<tr>
															<td class="pad"
																style="padding-bottom:10px;width:100%;padding-right:0px;padding-left:0px;">
																<div align="center" class="alignment" style="line-height:10px">
																	<div style="max-width: 84px;"><img alt="" height="auto"
																			src="{{companyLogo}}"
																			style="display: block; height: auto; border: 0; width: 100%;" title=""
																			width="84" /></div>
																</div>
															</td>
														</tr>
													</table>
													<table border="0" cellpadding="10" cellspacing="0" class="divider_block block-2"
														role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
														<tr>
															<td class="pad">
																<div align="center" class="alignment">
																	<table border="0" cellpadding="0" cellspacing="0" role="presentation"
																		style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
																		<tr>
																			<td class="divider_inner"
																				style="font-size: 1px; line-height: 1px; border-top: 1px solid #E4DAFF;"><span
																					style="word-break: break-word;"> </span></td>
																		</tr>
																	</table>
																</div>
															</td>
														</tr>
													</table>
													<table border="0" cellpadding="0" cellspacing="0" class="paragraph_block block-3"
														role="presentation"
														style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;" width="100%">
														<tr>
															<td class="pad" style="padding-bottom:5px;padding-top:5px;">
																<div
																	style="color:#444a5b;direction:ltr;font-family:'Inter','Arial';font-size:14px;font-weight:400;letter-spacing:0px;line-height:150%;text-align:center;mso-line-height-alt:21px;">
																	<p style="margin: 0; margin-bottom: 16px;">Copyright © {{year}} {{companyName}}, All rights
																		reserved.</p>
																	<p style="margin: 0; margin-bottom: 16px;"><strong>Where to find
																			us</strong><br />{{providerEmail}}<br />{{companyAddress}}</p>
																	<p style="margin: 0;">Changed your mind? You can <a href="{{unsubscribeLink}}"
																			rel="noopener" style="text-decoration: underline; color: #7747ff;"
																			target="_blank">unsubscribe</a> at any time.</p>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
									<table align="center" border="0" cellpadding="0" cellspacing="0" class="row-content"
										role="presentation"
										style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-radius: 0; color: #000000; width: 600px; margin: 0 auto;"
										width="600">
										<tbody>
											<tr>
												<td class="column column-1"
													style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-left: 5px; padding-right: 5px; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;"
													width="75%">
													<table border="0" cellpadding="15" cellspacing="0" class="paragraph_block block-1"
														role="presentation"
														style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;" width="100%">
														<tr>
															<td class="pad">
																<div
																	style="color:#101112;direction:ltr;font-family:'Ubuntu', Tahoma, Verdana, Segoe, sans-serif;font-size:16px;font-weight:400;letter-spacing:0px;line-height:120%;text-align:right;mso-line-height-alt:19.2px;">
																	<p style="margin: 0;">Powered by</p>
																</div>
															</td>
														</tr>
													</table>
												</td>
												<td class="column column-2"
													style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;"
													width="25%">
													<table border="0" cellpadding="0" cellspacing="0" class="image_block block-1"
														role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
														<tr>
															<td class="pad" style="width:100%;padding-right:0px;padding-left:0px;">
																<div align="left" class="alignment" style="line-height:10px">
																	<div style="max-width: 45px;"><img alt="" height="auto"
																			src="https://github.com/user-attachments/assets/ce5e8bfd-2e76-4048-ae7c-b0bd9cfd0203"
																			style="display: block; height: auto; border: 0; width: 100%;" title=""
																			width="45" /></div>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
				</td>
			</tr>
		</tbody>
	</table><!-- End -->
</body>

</html>
`

export const completeOtpEmailTemplate = {
    htmlTemplate: otpNewTemplate,
    subject: "Password Reset OTP",
    staticPayload: {
        year: String(new Date().getFullYear()),
        unsubscribeLink: "https://d-auth.com/unsubscribe",
        reportIssueLink: "https://d-auth.com/reportissue",
        reportLink: "https://d-auth.com/report",
    }
};