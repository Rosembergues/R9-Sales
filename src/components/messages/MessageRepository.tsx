import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, Copy, Link2, MessageSquareText, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

type MessageCampaign = { id: string; title: string; description: string; kind: 'folder' | 'action'; audience: string | null; product: string | null; starts_on: string | null; valid_until: string | null; created_by: string; };
type RepositoryMessage = { id: string; title: string; content: string; stage: string; created_by: string; created_by_name: string; created_at: string; };
type MessageLink = { campaign_id: string; message_id: string };
const stages = ['Geral', 'Abordagem', 'Acompanhamento', 'Objeções', 'Fechamento'];

export const MessageRepository: React.FC = () => {
  const { currentUser } = useAuth();
  const [campaigns, setCampaigns] = useState<MessageCampaign[]>([]);
  const [messages, setMessages] = useState<RepositoryMessage[]>([]);
  const [links, setLinks] = useState<MessageLink[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [campaignForm, setCampaignForm] = useState(false);
  const [messageForm, setMessageForm] = useState(false);
  const [linkForm, setLinkForm] = useState(false);
  const [campaignEditing, setCampaignEditing] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [campaignTitle, setCampaignTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<'folder' | 'action'>('folder');
  const [audience, setAudience] = useState('');
  const [product, setProduct] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [messageTitle, setMessageTitle] = useState('');
  const [content, setContent] = useState('');
  const [stage, setStage] = useState('Geral');
  const [messageCampaigns, setMessageCampaigns] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isAdmin = currentUser?.role === 'admin';
  const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500';

  const refresh = useCallback(async () => {
    const [campaignResult, messageResult, linkResult] = await Promise.all([
      supabase.from('message_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('repository_messages').select('*').order('created_at', { ascending: false }),
      supabase.from('repository_message_campaigns').select('campaign_id,message_id'),
    ]);
    if (campaignResult.error || messageResult.error || linkResult.error) {
      setError('Não foi possível carregar o repositório. Confira as tabelas e permissões no Supabase.');
      return;
    }
    setError('');
    setCampaigns(campaignResult.data || []);
    setMessages(messageResult.data || []);
    setLinks(linkResult.data || []);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const channel = supabase.channel('message-repository')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_campaigns' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repository_messages' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repository_message_campaigns' }, () => { void refresh(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refresh]);

  const campaignById = useMemo(() => new Map(campaigns.map(campaign => [campaign.id, campaign])), [campaigns]);
  const messageById = useMemo(() => new Map(messages.map(message => [message.id, message])), [messages]);
  const selectedCampaign = campaignById.get(selected || '');
  const selectedMessages = links.filter(link => link.campaign_id === selected).map(link => messageById.get(link.message_id)).filter((message): message is RepositoryMessage => Boolean(message));
  const canManageCampaign = (campaign: MessageCampaign) => isAdmin || campaign.created_by === currentUser?.id;

  const resetCampaignForm = () => {
    setCampaignForm(false); setCampaignEditing(null); setCampaignTitle(''); setDescription(''); setKind('folder'); setAudience(''); setProduct(''); setStartsOn(''); setValidUntil('');
  };
  const saveCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const values = { title: campaignTitle.trim(), description: description.trim(), kind, audience: kind === 'action' ? audience.trim() : null, product: kind === 'action' ? product.trim() : null, starts_on: kind === 'action' ? startsOn || null : null, valid_until: kind === 'action' ? validUntil || null : null };
    const request = campaignEditing
      ? supabase.from('message_campaigns').update(values).eq('id', campaignEditing)
      : supabase.from('message_campaigns').insert({ ...values, created_by: currentUser?.id });
    const { error: saveError } = await request;
    setSaving(false);
    if (saveError) { setError(saveError.message.includes('message_campaigns_action_details') ? 'Ação precisa ter público, produto e período válido.' : 'Não foi possível salvar a campanha.'); return; }
    resetCampaignForm(); await refresh();
  };

  const openCampaign = (campaign?: MessageCampaign) => {
    if (campaign) {
      setCampaignEditing(campaign.id); setCampaignTitle(campaign.title); setDescription(campaign.description || ''); setKind(campaign.kind);
      setAudience(campaign.audience || ''); setProduct(campaign.product || ''); setStartsOn(campaign.starts_on || ''); setValidUntil(campaign.valid_until || '');
    } else resetCampaignForm();
    setCampaignForm(true);
  };

  const resetMessageForm = () => { setMessageForm(false); setEditing(null); setMessageTitle(''); setContent(''); setStage('Geral'); setMessageCampaigns(selected ? [selected] : []); };
  const openMessage = (message?: RepositoryMessage) => {
    if (message) {
      setEditing(message.id); setMessageTitle(message.title); setContent(message.content); setStage(message.stage || 'Geral');
      setMessageCampaigns(links.filter(link => link.message_id === message.id).map(link => link.campaign_id));
    } else { setEditing(null); setMessageTitle(''); setContent(''); setStage('Geral'); setMessageCampaigns(selected ? [selected] : []); }
    setMessageForm(true);
  };

  const saveMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!messageCampaigns.length) { setError('Vincule a mensagem a pelo menos uma campanha.'); return; }
    setSaving(true);
    let messageId = editing;
    let saveError: { message: string } | null = null;
    if (editing) {
      const result = await supabase.from('repository_messages').update({ title: messageTitle.trim(), content: content.trim(), stage }).eq('id', editing);
      saveError = result.error;
    } else {
      const result = await supabase.from('repository_messages').insert({ title: messageTitle.trim(), content: content.trim(), stage, created_by: currentUser?.id, created_by_name: currentUser?.name || '' }).select('id').single();
      saveError = result.error;
      messageId = result.data?.id;
    }
    if (!saveError && messageId) {
      const previous = links.filter(link => link.message_id === messageId).map(link => link.campaign_id);
      const additions = messageCampaigns.filter(id => !previous.includes(id)).map(campaign_id => ({ message_id: messageId, campaign_id }));
      const removals = previous.filter(id => !messageCampaigns.includes(id));
      if (additions.length) saveError = (await supabase.from('repository_message_campaigns').insert(additions)).error;
      for (const campaignId of removals) {
        if (saveError) break;
        saveError = (await supabase.from('repository_message_campaigns').delete().eq('message_id', messageId).eq('campaign_id', campaignId)).error;
      }
    }
    setSaving(false);
    if (saveError) { setError('A mensagem foi salva parcialmente ou não pôde ser vinculada. Confira suas permissões e tente atualizar.'); await refresh(); return; }
    resetMessageForm(); await refresh();
  };

  const attachMessage = async (messageId: string) => {
    if (!selected) return;
    const { error: linkError } = await supabase.from('repository_message_campaigns').insert({ message_id: messageId, campaign_id: selected });
    if (linkError) { setError('Não foi possível vincular a mensagem.'); return; }
    setLinkForm(false); await refresh();
  };

  const unlinkMessage = async (message: RepositoryMessage) => {
    if (!selected || !window.confirm(`Remover “${message.title}” desta campanha? O conteúdo continua disponível nas outras campanhas.`)) return;
    const { error: unlinkError } = await supabase.from('repository_message_campaigns').delete().eq('message_id', message.id).eq('campaign_id', selected);
    if (unlinkError) { setError('Não foi possível remover o vínculo.'); return; }
    await refresh();
  };

  const deleteCampaign = async (campaign: MessageCampaign) => {
    if (!window.confirm(`Excluir “${campaign.title}”? As mensagens compartilhadas continuarão nas outras campanhas.`)) return;
    const { error: deleteError } = await supabase.from('message_campaigns').delete().eq('id', campaign.id);
    if (deleteError) { setError('Apenas administradores podem excluir campanhas.'); return; }
    if (selected === campaign.id) setSelected(null);
    await refresh();
  };

  const deleteMessage = async (message: RepositoryMessage) => {
    if (!window.confirm(`Excluir “${message.title}” de todas as campanhas?`)) return;
    const { error: deleteError } = await supabase.from('repository_messages').delete().eq('id', message.id);
    if (deleteError) { setError('Apenas administradores podem excluir mensagens.'); return; }
    await refresh();
  };

  const copyMessage = async (message: RepositoryMessage) => {
    try { await navigator.clipboard.writeText(message.content); setCopied(message.id); window.setTimeout(() => setCopied(null), 1800); }
    catch { setError('O navegador não permitiu copiar. Selecione o texto e copie manualmente.'); }
  };

  const matchingMessages = messages.filter(message => `${message.title} ${message.content}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const matchingCampaigns = campaigns.filter(campaign => {
    const text = `${campaign.title} ${campaign.description} ${campaign.audience || ''} ${campaign.product || ''}`.toLocaleLowerCase();
    return !search || text.includes(search.toLocaleLowerCase()) || links.some(link => link.campaign_id === campaign.id && messageById.get(link.message_id) && `${messageById.get(link.message_id)!.title} ${messageById.get(link.message_id)!.content}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  });
  const inputCampaigns = campaigns;

  const messageCard = (message: RepositoryMessage, showCampaignNames = false) => {
    const linkedCampaigns = links.filter(link => link.message_id === message.id).map(link => campaignById.get(link.campaign_id)).filter((campaign): campaign is MessageCampaign => Boolean(campaign));
    return <article key={message.id} className="rounded-xl border border-slate-200 bg-sky-50 p-4">
      <div className="flex items-start justify-between gap-3"><div><h2 className="rounded-lg bg-white/80 px-3 py-2 text-sm font-bold text-slate-800">{message.title}</h2><span className="mt-2 inline-block rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-800">{message.stage}</span></div><button onClick={() => void copyMessage(message)} title="Copiar mensagem" aria-label="Copiar mensagem" className="rounded-lg bg-white p-2 text-blue-700">{copied === message.id ? <Check size={18} /> : <Copy size={18} />}</button></div>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-white/80 p-3 font-sans text-sm leading-relaxed text-slate-700">{message.content}</pre>
      {showCampaignNames && <div className="mt-2 flex flex-wrap gap-1">{linkedCampaigns.map(campaign => <button key={campaign.id} onClick={() => { setSelected(campaign.id); setShowAllMessages(false); }} className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-600">{campaign.title}</button>)}{!linkedCampaigns.length && <span className="text-xs text-amber-700">Sem campanha vinculada</span>}</div>}
      <footer className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{message.created_by_name || 'Equipe'} · {message.created_at ? new Date(message.created_at).toLocaleDateString('pt-BR') : ''}</span><div className="flex gap-2">{(isAdmin || message.created_by === currentUser?.id) && <button onClick={() => openMessage(message)} className="rounded px-2 py-1 font-semibold text-blue-700">Editar</button>}{selected && selectedMessages.some(item => item.id === message.id) && (isAdmin || message.created_by === currentUser?.id || canManageCampaign(selectedCampaign!)) && <button onClick={() => void unlinkMessage(message)} title="Remover desta campanha" className="rounded p-1 text-slate-500"><Link2 size={16} /></button>}{isAdmin && <button onClick={() => void deleteMessage(message)} aria-label="Excluir mensagem" className="rounded p-1 text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>}</div></footer>
    </article>;
  };

  return <section className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#0078d4] px-5 py-4 text-white">
      <div className="flex items-center gap-3">{selected && !showAllMessages && <button onClick={() => { setSelected(null); setMessageForm(false); }} aria-label="Voltar às campanhas"><ArrowLeft /></button>}<div><h1 className="text-xl font-bold">{showAllMessages ? 'Todas as mensagens' : selectedCampaign?.title || 'Biblioteca de WhatsApp'}</h1><p className="text-sm text-blue-100">{selectedCampaign ? selectedCampaign.description : 'Campanhas organizam mensagens recorrentes e ações com prazo'}</p></div></div>
      {!selected && <div className="flex gap-2"><button onClick={() => setShowAllMessages(false)} className={`rounded-lg px-3 py-2 text-sm ${!showAllMessages ? 'bg-white text-blue-700' : 'bg-blue-600 text-white'}`}>Campanhas</button><button onClick={() => setShowAllMessages(true)} className={`rounded-lg px-3 py-2 text-sm ${showAllMessages ? 'bg-white text-blue-700' : 'bg-blue-600 text-white'}`}>Todas as mensagens</button></div>}
      {!showAllMessages && (selected ? <div className="flex gap-2">{selectedCampaign && canManageCampaign(selectedCampaign) && <button onClick={() => setLinkForm(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold"><Link2 size={16} /> Vincular existente</button>}<button onClick={() => openMessage()} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-blue-700"><Plus size={17} /> Nova mensagem</button></div> : <button onClick={() => openCampaign()} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-blue-700"><Plus size={17} /> Nova campanha</button>)}
    </header>

    <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={showAllMessages || selected ? 'Buscar mensagens pelo título ou conteúdo' : 'Buscar campanhas ou mensagens'} className={`${inputClass} pl-9`} /></label>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

    {showAllMessages ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{matchingMessages.map(message => messageCard(message, true))}{!matchingMessages.length && <p className="col-span-full rounded-xl border border-dashed p-10 text-center text-sm text-slate-500">Nenhuma mensagem encontrada.</p>}</div>
      : selected && selectedCampaign ? <>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{selectedCampaign.kind === 'folder' ? 'Pasta permanente' : 'Ação'}</span>{selectedCampaign.kind === 'action' && <><span>Público: {selectedCampaign.audience}</span><span>Produto: {selectedCampaign.product}</span><span className="flex items-center gap-1"><CalendarDays size={15} />{new Date(`${selectedCampaign.starts_on}T00:00:00`).toLocaleDateString('pt-BR')} – {new Date(`${selectedCampaign.valid_until}T00:00:00`).toLocaleDateString('pt-BR')}</span></>}</div>
        {selectedCampaign.kind === 'action' && selectedCampaign.valid_until && selectedCampaign.valid_until < new Date().toISOString().slice(0, 10) && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Esta ação passou do prazo. O histórico e as mensagens continuam disponíveis.</p>}
        {canManageCampaign(selectedCampaign) && <button onClick={() => openCampaign(selectedCampaign)} className="text-sm font-semibold text-blue-700">Editar detalhes da campanha</button>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{selectedMessages.filter(message => !search || `${message.title} ${message.content}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(message => messageCard(message))}{!selectedMessages.length && <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500"><MessageSquareText className="mx-auto mb-2" />Nenhuma mensagem nesta campanha.</div>}</div>
      </> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{matchingCampaigns.map(campaign => <article key={campaign.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md">
          <div className="flex items-start justify-between gap-3"><button onClick={() => { setSelected(campaign.id); setShowAllMessages(false); }} className="text-left text-lg font-semibold text-slate-800">{campaign.title}</button><div className="flex gap-1">{canManageCampaign(campaign) && <button onClick={() => openCampaign(campaign)} aria-label="Editar campanha" className="rounded p-1 text-slate-400 hover:text-blue-600"><span className="text-xs">Editar</span></button>}{isAdmin && <button onClick={() => void deleteCampaign(campaign)} aria-label="Excluir campanha" className="rounded p-1 text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>}</div></div>
          <p className="mt-1 min-h-10 text-sm text-slate-500">{campaign.description || (campaign.kind === 'folder' ? 'Pasta de mensagens recorrentes' : '')}</p>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{links.filter(link => link.campaign_id === campaign.id).length} mensagens</span>{campaign.kind === 'action' && campaign.valid_until && <span className="flex items-center gap-1"><CalendarDays size={14} />Até {new Date(`${campaign.valid_until}T00:00:00`).toLocaleDateString('pt-BR')}</span>}</div>
          <button onClick={() => { setSelected(campaign.id); setShowAllMessages(false); }} className="mt-3 text-xs font-semibold text-blue-700">Abrir campanha →</button>
        </article>)}{!matchingCampaigns.length && <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Nenhuma campanha encontrada. Crie uma pasta ou uma ação.</div>}</div>}

    {campaignForm && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"><form onSubmit={saveCampaign} className="my-6 w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-lg font-bold">{campaignEditing ? 'Editar campanha' : 'Nova campanha'}</h2><label className="block text-xs font-semibold">Tipo<select value={kind} onChange={event => setKind(event.target.value as 'folder' | 'action')} className={`${inputClass} mt-1`}><option value="folder">Pasta permanente</option><option value="action">Ação com período</option></select></label><label className="block text-xs font-semibold">Nome<input required value={campaignTitle} onChange={event => setCampaignTitle(event.target.value)} className={`${inputClass} mt-1`} /></label><label className="block text-xs font-semibold">Descrição / objetivo<input value={description} onChange={event => setDescription(event.target.value)} className={`${inputClass} mt-1`} /></label>{kind === 'action' && <><label className="block text-xs font-semibold">Público<input required value={audience} onChange={event => setAudience(event.target.value)} className={`${inputClass} mt-1`} /></label><label className="block text-xs font-semibold">Produto ou BU<input required value={product} onChange={event => setProduct(event.target.value)} className={`${inputClass} mt-1`} /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Início<input required type="date" value={startsOn} onChange={event => setStartsOn(event.target.value)} className={`${inputClass} mt-1`} /></label><label className="text-xs font-semibold">Prazo final<input required type="date" min={startsOn || undefined} value={validUntil} onChange={event => setValidUntil(event.target.value)} className={`${inputClass} mt-1`} /></label></div></>}<div className="flex justify-end gap-2"><button type="button" onClick={resetCampaignForm} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Salvar</button></div></form></div>}

    {messageForm && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"><form onSubmit={saveMessage} className="my-6 w-full max-w-2xl space-y-4 rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-lg font-bold">{editing ? 'Editar mensagem' : 'Nova mensagem de WhatsApp'}</h2><label className="block text-xs font-semibold">Título<input required value={messageTitle} onChange={event => setMessageTitle(event.target.value)} className={`${inputClass} mt-1`} /></label><label className="block text-xs font-semibold">Etapa comercial<select value={stage} onChange={event => setStage(event.target.value)} className={`${inputClass} mt-1`}>{stages.map(option => <option key={option}>{option}</option>)}</select></label><label className="block text-xs font-semibold">Conteúdo<textarea required rows={8} value={content} onChange={event => setContent(event.target.value)} className={`${inputClass} mt-1 font-mono`} /></label><fieldset className="space-y-2"><legend className="text-xs font-semibold">Campanhas vinculadas (selecione uma ou mais)</legend><div className="grid max-h-36 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">{inputCampaigns.map(campaign => <label key={campaign.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={messageCampaigns.includes(campaign.id)} onChange={event => setMessageCampaigns(ids => event.target.checked ? [...ids, campaign.id] : ids.filter(id => id !== campaign.id))} />{campaign.title}</label>)}</div></fieldset><div className="flex justify-end gap-2"><button type="button" onClick={resetMessageForm} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Salvar</button></div></form></div>}

    {linkForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-lg font-bold">Vincular mensagem existente</h2><div className="max-h-[60vh] space-y-2 overflow-y-auto">{matchingMessages.filter(message => !links.some(link => link.campaign_id === selected && link.message_id === message.id)).map(message => <button key={message.id} onClick={() => void attachMessage(message.id)} className="w-full rounded-lg border p-3 text-left hover:border-blue-400"><span className="block font-semibold">{message.title}</span><span className="mt-1 line-clamp-2 block whitespace-pre-wrap text-xs text-slate-500">{message.content}</span></button>)}{!matchingMessages.some(message => !links.some(link => link.campaign_id === selected && link.message_id === message.id)) && <p className="text-sm text-slate-500">Nenhuma outra mensagem encontrada.</p>}</div><div className="flex justify-end"><button onClick={() => setLinkForm(false)} className="rounded-lg border px-4 py-2 text-sm">Fechar</button></div></div></div>}
  </section>;
};
