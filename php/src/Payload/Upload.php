<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Payload;

/** One uploaded file, reduced to the facts the file rules judge. */
final readonly class Upload
{
	/** @param int $error the PHP upload error code, `0` for a file the server received whole */
	public function __construct(public string $name, public string $type, public int $size, public int $error = 0)
	{
	}
}
