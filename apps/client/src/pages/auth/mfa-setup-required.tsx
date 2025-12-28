import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { getAppName } from "@/lib/config";
import { MfaSetupForm } from "@/features/auth/components/mfa-setup-form";

export default function MfaSetupRequiredPage() {
    const { t } = useTranslation();

    return (
        <>
            <Helmet>
                <title>
                    {t("Set up two-factor authentication")} - {getAppName()}
                </title>
            </Helmet>
            <MfaSetupForm />
        </>
    );
}
