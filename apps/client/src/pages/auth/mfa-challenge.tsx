import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { getAppName } from "@/lib/config";
import { MfaChallengeForm } from "@/features/auth/components/mfa-challenge-form";

export default function MfaChallengePage() {
    const { t } = useTranslation();

    return (
        <>
            <Helmet>
                <title>
                    {t("Two-factor authentication")} - {getAppName()}
                </title>
            </Helmet>
            <MfaChallengeForm />
        </>
    );
}
