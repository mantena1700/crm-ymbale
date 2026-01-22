import ReprocessClient from './ReprocessClient';

export default function PackagingAnalysisPage() {
    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '30px' }}>Análise de Embalagem (iFood)</h1>
            <ReprocessClient />
        </div>
    );
}
