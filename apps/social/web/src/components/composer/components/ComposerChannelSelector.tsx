import { APPROVED_CHANNELS, composerChannel } from '~/cryptoart/policy';

interface Props { channelKey?: string; selectChannel: (value: { channelKey?: string }) => void }
export function ComposerChannelSelector({ channelKey, selectChannel }: Props) {
  return <label className="flex items-center gap-2 text-sm">Channel
    <select aria-label="Post channel" value={composerChannel(channelKey)}
      className="rounded-md border border-default bg-elevated px-2 py-1"
      onChange={event => selectChannel({ channelKey: composerChannel(event.target.value) })}>
      {APPROVED_CHANNELS.map(channel => <option key={channel} value={channel}>/{channel}</option>)}
    </select>
  </label>;
}
