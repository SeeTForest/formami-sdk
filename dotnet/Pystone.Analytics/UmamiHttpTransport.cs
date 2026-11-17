namespace Pystone.Analytics;

/// <summary>Compatibility name; new consumers should use FormamiHttpTransport.</summary>
public sealed class UmamiHttpTransport : FormamiHttpTransport
{
    public UmamiHttpTransport(AnalyticsOptions options, HttpClient? httpClient = null)
        : base(options, httpClient) { }
}
