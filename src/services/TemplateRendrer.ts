import AuthConfig from "../config/authConfig";

interface TemplateVariables {
  [key: string]: string;
}

interface Template {
  htmlTemplate: string;
  staticPayload?: TemplateVariables;
  subject: string;
}

export class TemplateRenderer {
  private template: Template;

  constructor(template: {htmlTemplate: string, staticPayload: TemplateVariables, subject: string} ) {
    this.template = template;
  }

  /**
   * Replaces placeholders in the template with actual values
   * @param variables - Key-value pairs for template placeholders
   * @returns Rendered template as a string
   */
  render(variables: TemplateVariables): string {
    let renderedTemplate = this.template.htmlTemplate;

    const fullVariables = {
      ...variables,
      ...this.template.staticPayload,
      companyName: AuthConfig.getInstance().companyDetails.name,
      providerEmail: AuthConfig.getInstance().nodeMailerConfig.auth.user,
      companyAddress: AuthConfig.getInstance().companyDetails.address,
    }

    Object.entries(fullVariables).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, "g");
      renderedTemplate = renderedTemplate.replace(placeholder, value);
    });

    return renderedTemplate;
  }
}
