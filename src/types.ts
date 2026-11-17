export type Screen = 'inicio' | 'gerador_pro' | 'biblioteca';

export type TransitionType = 'none' | 'push' | 'push_back';

export type BlockType = 
  | 'header'
  | 'header_text'
  | 'header_image'
  | 'title'
  | 'subtitle'
  | 'text'
  | 'button'
  | 'image'
  | 'coupon'
  | 'divider'
  | 'social'
  | 'footer'
  | 'columns';

/** One cell of a "columns" block: an optional image, text and button, side by side with the others. */
export interface ColumnCell {
  imageUrl?: string;
  imageAlt?: string;
  imageLink?: string;
  text?: string;
  buttonLabel?: string;
  buttonUrl?: string;
}

export interface EmailBlock {
  id: string;
  type: BlockType;
  
  // Text content
  text?: string;
  
  // Font and typography formatting
  fontSizePx?: number;
  fontSize?: 'sm' | 'md' | 'lg' | 'xl';
  textColor?: string;
  bgColor?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  fontFamily?: string;
  lineHeight?: string;

  // Header properties
  headerTitle?: string;
  headerSubtitle?: string;
  headerBgColor?: string;
  headerTextColor?: string;
  headerSubtitleColor?: string;
  headerSubtitleSizePx?: number;

  // Button properties
  buttonLabel?: string;
  buttonUrl?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  buttonWidth?: 'full' | 'auto';

  // Image properties
  imageUrl?: string;
  imageAlt?: string;
  imageLink?: string;
  imageCaption?: string;
  /** Largura visual do cabeçalho de imagem em pixels; limitado pelo container. */
  imageWidthPx?: number;

  // Coupon properties
  couponCode?: string;
  couponDiscount?: string;
  couponTitle?: string;
  couponExpiry?: string;
  couponBgColor?: string;
  couponBorderColor?: string;

  // Divider properties
  dividerStyle?: 'solid' | 'dashed' | 'dotted';
  dividerColor?: string;
  dividerHeight?: number;

  // Social properties
  instagramUrl?: string;
  whatsappUrl?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  websiteUrl?: string;

  // Footer properties
  footerText?: string;
  footerBgColor?: string;
  footerTextColor?: string;

  // Columns (2 or 3 cells side by side; stacked on mobile)
  columns?: ColumnCell[];
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  badge?: string;
  image: string;
  headerTitle: string;
  greeting: string;
  buttonText: string;
  buttonUrl: string;
  bodyText: string;
  footerText: string;
  primaryColor: string;
  customCodeHtml?: string;
}

export type ContentSource = 'blocks' | 'html';

export interface EmailData {
  documentId?: string;
  subject?: string;
  /** Texto exibido ao lado do assunto na caixa de entrada (preheader). */
  preheader?: string;
  contentSource?: ContentSource;
  headerTitle: string;
  greeting: string;
  buttonText: string;
  buttonUrl: string;
  bodyText: string;
  footerText?: string;
  primaryColor: string;
  activeTemplateId: string;
  customCodeHtml?: string;

  // Advanced Layout & Responsive options
  alignment?: 'center' | 'left';
  mobileButtonWidth?: 'full' | 'auto';
  cardBorderRadius?: 'none' | 'soft' | 'modern';
  fontSizeLevel?: 'normal' | 'large_mobile';
}


export type EditableBlockProperty = Exclude<keyof EmailBlock, 'id' | 'type'>;
