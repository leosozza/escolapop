-- Adicionar novos valores ao enum team_sector
ALTER TYPE team_sector ADD VALUE IF NOT EXISTS 'maquiagem';
ALTER TYPE team_sector ADD VALUE IF NOT EXISTS 'edicao_imagem';
ALTER TYPE team_sector ADD VALUE IF NOT EXISTS 'fotografo';
ALTER TYPE team_sector ADD VALUE IF NOT EXISTS 'gerente';
ALTER TYPE team_sector ADD VALUE IF NOT EXISTS 'video_maker';

-- Adicionar novo valor ao enum team_area
ALTER TYPE team_area ADD VALUE IF NOT EXISTS 'producao';