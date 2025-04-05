// src/components/chat/ModelSelector.tsx
import React, { memo, useMemo } from 'react';
import { useTheme } from '../../styles/ThemeProvider';
import { isPlanAtLeast } from '../../monetization/planManager';
import { ModelService } from '../../services/modelService';

interface ModelSelectorProps {
    selectedModel: string;
    onModelChange: (modelId: string) => void;
    aiMode: 'local' | 'cloud';
    onAIModeChange: (mode: 'local' | 'cloud') => void;
    localModels: string[];
    modelRegistry: Record<string, any>;
}

const ModelSelector = memo(({
    selectedModel,
    onModelChange,
    aiMode,
    onAIModeChange,
    localModels,
    modelRegistry
}: ModelSelectorProps) => {
    const theme = useTheme();

    // Memoize model groups to prevent recalculation on every render
    const { localModelsGroup, cloudModelsGroup, activeModelsGroup } = useMemo(() => {
        const localModelsGroup = Object.values(modelRegistry)
            .filter(model => model.mode === 'local');
            
        const cloudModelsGroup = Object.values(modelRegistry)
            .filter(model => model.mode === 'cloud');
            
        // Get active models that are installed
        const activeLocalModels = ModelService.getActiveLocalModels();
        
        // Filter installed models to only show the active ones
        const activeModelsGroup = localModels
            .filter(modelName => activeLocalModels.includes(modelName))
            .map(modelName => ({
                id: modelName,
                name: modelName,
                planRequired: 'LocalPro'
            }));
            
        return { localModelsGroup, cloudModelsGroup, activeModelsGroup };
    }, [modelRegistry, localModels]);

    // Get active models based on current mode
    const activeModels = useMemo(() => {
        return aiMode === 'local' ? localModelsGroup : cloudModelsGroup;
    }, [aiMode, localModelsGroup, cloudModelsGroup]);

    // Set default model when switching modes (if current selection doesn't match mode)
    React.useEffect(() => {
        const currentModelInfo = modelRegistry[selectedModel];
        const isModelModeMatch = currentModelInfo && currentModelInfo.mode === aiMode;
        const isModelActive = ModelService.isModelActive(selectedModel);
        
        // If current model doesn't match the mode or isn't an active model
        if (!isModelModeMatch && !isModelActive) {
            // Find a default model for the current mode
            const defaultModel = activeModels.find(model =>
                isPlanAtLeast(model.planRequired)
            );
            
            if (defaultModel) {
                onModelChange(defaultModel.id);
            }
        }
    }, [aiMode, selectedModel, modelRegistry, activeModels, onModelChange]);

    return (
        <div style={{ marginBottom: '16px' }}>
            {/* Mode toggle - now uses icon buttons */}
            <div style={{
                display: 'inline-flex',
                borderRadius: '6px',
                backgroundColor: theme.colors.backgroundDark,
                padding: '3px',
                marginBottom: '12px'
            }}>
                <button
                    onClick={() => onAIModeChange('local')}
                    style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        backgroundColor: aiMode === 'local' ? theme.colors.secondary : 'transparent',
                        color: aiMode === 'local' ? theme.colors.backgroundDark : theme.colors.textMuted,
                        fontWeight: 500,
                        fontSize: '13px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <span style={{ fontSize: '12px' }}>💻</span>
                    Local
                </button>
                <button
                    onClick={() => onAIModeChange('cloud')}
                    style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        backgroundColor: aiMode === 'cloud' ? theme.colors.primary : 'transparent',
                        color: aiMode === 'cloud' ? theme.colors.backgroundDark : theme.colors.textMuted,
                        fontWeight: 500,
                        fontSize: '13px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <span style={{ fontSize: '12px' }}>☁️</span>
                    Cloud
                </button>
            </div>
            
            {/* Model dropdown - reduced height */}
            <div style={{ position: 'relative' }}>
                <select
                    value={selectedModel}
                    onChange={e => onModelChange(e.target.value)}
                    style={{
                        padding: '8px 12px', // Reduced padding
                        backgroundColor: theme.colors.backgroundDark,
                        color: theme.colors.text,
                        borderRadius: '6px',
                        border: `1px solid ${theme.colors.border}`,
                        width: '100%',
                        fontSize: '13px', // Reduced font size
                        appearance: 'none',
                        backgroundImage:
                            'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        backgroundSize: '12px auto',
                        paddingRight: '28px',
                    }}
                    aria-label="Select model"
                >
                    {/* Show built-in models for the current mode */}
                    <optgroup label={aiMode === 'local' ? "Local Models" : "Cloud Models"}>
                        {activeModels.map(model => (
                            <option key={model.id} value={model.id} disabled={!isPlanAtLeast(model.planRequired)}>
                                {model.name} {!isPlanAtLeast(model.planRequired) ? '🔒' : ''}
                            </option>
                        ))}
                    </optgroup>
                    
                    {/* Show installed active models only in local mode */}
                    {aiMode === 'local' && activeModelsGroup.length > 0 && (
                        <optgroup label="Installed Models">
                            {activeModelsGroup.map(model => (
                                <option key={model.id} value={model.id}>{model.name}</option>
                            ))}
                        </optgroup>
                    )}
                </select>
            </div>
        </div>
    );
});

export default ModelSelector;